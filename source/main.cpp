#include <switch.h>
#include <curl/curl.h>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <string>
#include <vector>

#include "spotify.hpp"

namespace {
constexpr const char* CONFIG_PATH = "sdmc:/switch/CrystalSpotify/spotify.cfg";
constexpr const char* GREEN = "\x1b[32m";
constexpr const char* DIM = "\x1b[2m";
constexpr const char* RESET = "\x1b[0m";
constexpr const char* RED = "\x1b[31m";
constexpr const char* YELLOW = "\x1b[33m";

void clearScreen() {
    std::printf("\x1b[2J\x1b[H");
}

std::string msToTime(int ms) {
    if (ms < 0) ms = 0;
    const int totalSeconds = ms / 1000;
    const int minutes = totalSeconds / 60;
    const int seconds = totalSeconds % 60;
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%d:%02d", minutes, seconds);
    return buf;
}

std::string progressBar(int progress, int duration, int width = 42) {
    if (duration <= 0) return "[------------------------------------------]";
    const double ratio = std::max(0.0, std::min(1.0, static_cast<double>(progress) / duration));
    const int filled = static_cast<int>(ratio * width);
    std::string out = "[";
    for (int i = 0; i < width; ++i) out += (i < filled ? '=' : '-');
    out += "]";
    return out;
}

void draw(const PlaybackState& state, const std::string& error) {
    clearScreen();
    std::printf("%s============================================================%s\n", GREEN, RESET);
    std::printf("%s              CRYSTAL SPOTIFY - SWITCH  v0.1%s\n", GREEN, RESET);
    std::printf("%s============================================================%s\n\n", GREEN, RESET);

    if (!state.valid) {
        std::printf("%sNo active Spotify playback found.%s\n\n", YELLOW, RESET);
        std::printf("Start Spotify on your phone, PC, TV, or speaker, then press - to refresh.\n\n");
    } else {
        std::printf("%s%s%s\n", GREEN, state.isPlaying ? "> PLAYING" : "|| PAUSED", RESET);
        std::printf("Track : %s\n", state.track.empty() ? "(unknown)" : state.track.c_str());
        std::printf("Artist: %s\n", state.artists.empty() ? "(unknown)" : state.artists.c_str());
        std::printf("Album : %s\n", state.album.empty() ? "(unknown)" : state.album.c_str());
        std::printf("Device: %s", state.device.empty() ? "(unknown)" : state.device.c_str());
        if (state.volume >= 0) std::printf("  |  Volume %d%%", state.volume);
        std::printf("\n");
        std::printf("Shuffle: %s  |  Repeat: %s\n\n", state.shuffle ? "ON" : "OFF", state.repeatState.c_str());
        std::printf("%s\n", progressBar(state.progressMs, state.durationMs).c_str());
        std::printf("%s / %s\n\n", msToTime(state.progressMs).c_str(), msToTime(state.durationMs).c_str());
    }

    if (!error.empty()) std::printf("%sError: %s%s\n\n", RED, error.c_str(), RESET);

    std::printf("%sCONTROLS%s\n", DIM, RESET);
    std::printf("A Play/Pause     L Previous     R Next\n");
    std::printf("<- -10 sec       -> +10 sec     Y Shuffle\n");
    std::printf("ZL Volume -      ZR Volume +    X Devices\n");
    std::printf("- Refresh        + Exit\n");
    consoleUpdate(nullptr);
}

bool deviceMenu(SpotifyClient& spotify, PadState& pad) {
    std::vector<SpotifyDevice> devices;
    if (!spotify.getDevices(devices)) return false;

    int selected = 0;
    while (appletMainLoop()) {
        clearScreen();
        std::printf("%sSpotify Connect devices%s\n\n", GREEN, RESET);
        if (devices.empty()) {
            std::printf("No devices found. Open Spotify on another device first.\n\n");
        } else {
            for (size_t i = 0; i < devices.size(); ++i) {
                const auto& d = devices[i];
                std::printf("%s %s%s%s  [%s]",
                            static_cast<int>(i) == selected ? ">" : " ",
                            d.active ? GREEN : "",
                            d.name.c_str(),
                            d.active ? RESET : "",
                            d.type.c_str());
                if (d.volume >= 0) std::printf("  %d%%", d.volume);
                if (d.restricted) std::printf("  %sRESTRICTED%s", RED, RESET);
                std::printf("\n");
            }
        }
        std::printf("\nA = transfer playback here   B = back   X = refresh list\n");
        if (!spotify.lastError().empty()) std::printf("%s%s%s\n", RED, spotify.lastError().c_str(), RESET);
        consoleUpdate(nullptr);

        padUpdate(&pad);
        const u64 down = padGetButtonsDown(&pad);
        if (down & HidNpadButton_B) return true;
        if ((down & HidNpadButton_Up) && !devices.empty()) selected = std::max(0, selected - 1);
        if ((down & HidNpadButton_Down) && !devices.empty()) selected = std::min(static_cast<int>(devices.size()) - 1, selected + 1);
        if (down & HidNpadButton_X) {
            spotify.getDevices(devices);
            selected = std::min(selected, std::max(0, static_cast<int>(devices.size()) - 1));
        }
        if ((down & HidNpadButton_A) && !devices.empty()) {
            if (!devices[selected].restricted) {
                spotify.transfer(devices[selected].id, true);
                return true;
            }
        }
        svcSleepThread(16000000ULL);
    }
    return true;
}
} // namespace

int main(int argc, char** argv) {
    (void)argc;
    (void)argv;

    consoleInit(nullptr);
    padConfigureInput(1, HidNpadStyleSet_NpadStandard);
    PadState pad{};
    padInitializeDefault(&pad);

    const Result socketResult = socketInitializeDefault();
    if (R_FAILED(socketResult)) {
        clearScreen();
        std::printf("%sNetwork init failed: 0x%08X%s\n", RED, socketResult, RESET);
        std::printf("Press + to exit.\n");
        consoleUpdate(nullptr);
        while (appletMainLoop()) {
            padUpdate(&pad);
            if (padGetButtonsDown(&pad) & HidNpadButton_Plus) break;
            svcSleepThread(16000000ULL);
        }
        consoleExit(nullptr);
        return 1;
    }

    curl_global_init(CURL_GLOBAL_DEFAULT);

    SpotifyClient spotify;
    PlaybackState state;
    std::string uiError;

    if (!spotify.loadConfig(CONFIG_PATH)) {
        uiError = spotify.lastError();
    } else if (!spotify.refreshAccessToken()) {
        uiError = spotify.lastError();
    } else if (!spotify.getPlayback(state)) {
        uiError = spotify.lastError();
    }

    auto nextPoll = std::chrono::steady_clock::now() + std::chrono::seconds(2);
    bool redraw = true;

    while (appletMainLoop()) {
        padUpdate(&pad);
        const u64 down = padGetButtonsDown(&pad);

        if (down & HidNpadButton_Plus) break;

        if (spotify.ready()) {
            bool commandAttempted = false;
            bool commandSucceeded = true;

            if (down & HidNpadButton_A) {
                commandAttempted = true;
                commandSucceeded = state.isPlaying ? spotify.pause() : spotify.play();
            } else if (down & HidNpadButton_L) {
                commandAttempted = true;
                commandSucceeded = spotify.previous();
            } else if (down & HidNpadButton_R) {
                commandAttempted = true;
                commandSucceeded = spotify.next();
            } else if ((down & HidNpadButton_Left) && state.valid) {
                commandAttempted = true;
                commandSucceeded = spotify.seek(std::max(0, state.progressMs - 10000));
            } else if ((down & HidNpadButton_Right) && state.valid) {
                commandAttempted = true;
                commandSucceeded = spotify.seek(std::min(state.durationMs, state.progressMs + 10000));
            } else if ((down & HidNpadButton_ZL) && state.volume >= 0) {
                commandAttempted = true;
                commandSucceeded = spotify.setVolume(state.volume - 5);
            } else if ((down & HidNpadButton_ZR) && state.volume >= 0) {
                commandAttempted = true;
                commandSucceeded = spotify.setVolume(state.volume + 5);
            } else if (down & HidNpadButton_Y) {
                commandAttempted = true;
                commandSucceeded = spotify.setShuffle(!state.shuffle);
            } else if (down & HidNpadButton_X) {
                commandAttempted = true;
                commandSucceeded = deviceMenu(spotify, pad);
            } else if (down & HidNpadButton_Minus) {
                commandAttempted = true;
            }

            if (commandAttempted) {
                if (!commandSucceeded) uiError = spotify.lastError();
                svcSleepThread(150000000ULL);
                if (!spotify.getPlayback(state)) {
                    uiError = spotify.lastError();
                } else if (commandSucceeded) {
                    uiError.clear();
                }
                redraw = true;
                nextPoll = std::chrono::steady_clock::now() + std::chrono::seconds(2);
            }

            if (std::chrono::steady_clock::now() >= nextPoll) {
                if (!spotify.getPlayback(state)) uiError = spotify.lastError();
                else uiError.clear();
                redraw = true;
                nextPoll = std::chrono::steady_clock::now() + std::chrono::seconds(2);
            }
        }

        if (redraw) {
            draw(state, uiError);
            redraw = false;
        }
        svcSleepThread(16000000ULL);
    }

    curl_global_cleanup();
    socketExit();
    consoleExit(nullptr);
    return 0;
}
