#include "spotify.hpp"

#include <curl/curl.h>
#include <jansson.h>

#include <algorithm>
#include <cstdio>
#include <fstream>
#include <sstream>

namespace {
constexpr const char* API = "https://api.spotify.com/v1";
constexpr const char* TOKEN_URL = "https://accounts.spotify.com/api/token";

size_t writeCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    const size_t bytes = size * nmemb;
    auto* out = static_cast<std::string*>(userp);
    out->append(static_cast<const char*>(contents), bytes);
    return bytes;
}

std::string trim(const std::string& s) {
    const auto begin = s.find_first_not_of(" \t\r\n");
    if (begin == std::string::npos) return "";
    const auto end = s.find_last_not_of(" \t\r\n");
    return s.substr(begin, end - begin + 1);
}

std::string jsonString(json_t* obj, const char* key) {
    if (!obj) return "";
    json_t* value = json_object_get(obj, key);
    if (!value || !json_is_string(value)) return "";
    const char* s = json_string_value(value);
    return s ? s : "";
}

int jsonInt(json_t* obj, const char* key, int fallback = 0) {
    if (!obj) return fallback;
    json_t* value = json_object_get(obj, key);
    return (value && json_is_integer(value)) ? static_cast<int>(json_integer_value(value)) : fallback;
}

bool jsonBool(json_t* obj, const char* key, bool fallback = false) {
    if (!obj) return fallback;
    json_t* value = json_object_get(obj, key);
    return (value && json_is_boolean(value)) ? json_is_true(value) : fallback;
}

std::string formEscape(CURL* curl, const std::string& value) {
    char* encoded = curl_easy_escape(curl, value.c_str(), static_cast<int>(value.size()));
    if (!encoded) return "";
    std::string result(encoded);
    curl_free(encoded);
    return result;
}

std::string jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += c; break;
        }
    }
    return out;
}
} // namespace

bool SpotifyClient::loadConfig(const std::string& path) {
    configPath_ = path;
    std::ifstream file(path);
    if (!file) {
        lastError_ = "Missing spotify.cfg at " + path;
        return false;
    }

    std::string line;
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty() || line[0] == '#') continue;
        const auto eq = line.find('=');
        if (eq == std::string::npos) continue;
        const std::string key = trim(line.substr(0, eq));
        const std::string value = trim(line.substr(eq + 1));
        if (key == "client_id") config_.clientId = value;
        else if (key == "refresh_token") config_.refreshToken = value;
    }

    if (config_.clientId.empty() || config_.refreshToken.empty()) {
        lastError_ = "spotify.cfg needs client_id and refresh_token";
        return false;
    }
    return true;
}

SpotifyClient::HttpResponse SpotifyClient::request(const std::string& method,
                                                   const std::string& url,
                                                   const std::string& body,
                                                   const std::string& contentType,
                                                   bool useAuth) {
    HttpResponse result;
    CURL* curl = curl_easy_init();
    if (!curl) {
        result.curlError = "curl_easy_init failed";
        return result;
    }

    char errorBuffer[CURL_ERROR_SIZE] = {0};
    curl_easy_setopt(curl, CURLOPT_ERRORBUFFER, errorBuffer);
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 20L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "CrystalSpotify-Switch/0.1.0");
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &result.body);

    struct curl_slist* headers = nullptr;
    if (!contentType.empty()) {
        headers = curl_slist_append(headers, ("Content-Type: " + contentType).c_str());
    }
    if (useAuth && !accessToken_.empty()) {
        headers = curl_slist_append(headers, ("Authorization: Bearer " + accessToken_).c_str());
    }
    if (headers) curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    if (method == "POST") {
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    } else if (method != "GET") {
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method.c_str());
        if (method == "PUT" || method == "DELETE") {
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
            curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
        }
    }

    const CURLcode code = curl_easy_perform(curl);
    if (code != CURLE_OK) {
        result.curlError = errorBuffer[0] ? errorBuffer : curl_easy_strerror(code);
    }
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &result.status);

    if (headers) curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    return result;
}

void SpotifyClient::setApiError(const HttpResponse& r, const char* action) {
    std::ostringstream ss;
    ss << action << " failed";
    if (!r.curlError.empty()) ss << ": " << r.curlError;
    else ss << " (HTTP " << r.status << ")";

    if (!r.body.empty()) {
        json_error_t error{};
        json_t* root = json_loads(r.body.c_str(), 0, &error);
        if (root) {
            json_t* err = json_object_get(root, "error");
            if (err && json_is_object(err)) {
                const std::string msg = jsonString(err, "message");
                if (!msg.empty()) ss << ": " << msg;
            } else if (err && json_is_string(err)) {
                ss << ": " << json_string_value(err);
            }
            const std::string desc = jsonString(root, "error_description");
            if (!desc.empty()) ss << ": " << desc;
            json_decref(root);
        }
    }
    lastError_ = ss.str();
}

bool SpotifyClient::ok(const HttpResponse& r, const char* action) {
    if (r.curlError.empty() && r.status >= 200 && r.status < 300) {
        lastError_.clear();
        return true;
    }
    setApiError(r, action);
    return false;
}

bool SpotifyClient::refreshAccessToken() {
    CURL* curl = curl_easy_init();
    if (!curl) {
        lastError_ = "Could not start curl for Spotify login";
        return false;
    }
    const std::string body =
        "grant_type=refresh_token&refresh_token=" + formEscape(curl, config_.refreshToken) +
        "&client_id=" + formEscape(curl, config_.clientId);
    curl_easy_cleanup(curl);

    HttpResponse r = request("POST", TOKEN_URL, body, "application/x-www-form-urlencoded", false);
    if (!ok(r, "Spotify token refresh")) return false;

    json_error_t error{};
    json_t* root = json_loads(r.body.c_str(), 0, &error);
    if (!root) {
        lastError_ = "Spotify token response was invalid JSON";
        return false;
    }

    accessToken_ = jsonString(root, "access_token");
    const std::string rotated = jsonString(root, "refresh_token");
    json_decref(root);

    if (accessToken_.empty()) {
        lastError_ = "Spotify did not return an access token";
        return false;
    }

    if (!rotated.empty() && rotated != config_.refreshToken) {
        config_.refreshToken = rotated;
        std::ofstream file(configPath_, std::ios::trunc);
        if (file) {
            file << "client_id=" << config_.clientId << "\n";
            file << "refresh_token=" << config_.refreshToken << "\n";
        }
    }
    return true;
}

bool SpotifyClient::getPlayback(PlaybackState& out) {
    out = PlaybackState{};
    HttpResponse r = request("GET", std::string(API) + "/me/player", "", "", true);
    if (r.status == 204) {
        out.valid = false;
        lastError_.clear();
        return true;
    }
    if (r.status == 401 && refreshAccessToken()) {
        r = request("GET", std::string(API) + "/me/player", "", "", true);
    }
    if (!ok(r, "Get playback state")) return false;

    json_error_t error{};
    json_t* root = json_loads(r.body.c_str(), 0, &error);
    if (!root) {
        lastError_ = "Playback response was invalid JSON";
        return false;
    }

    out.valid = true;
    out.isPlaying = jsonBool(root, "is_playing");
    out.shuffle = jsonBool(root, "shuffle_state");
    out.repeatState = jsonString(root, "repeat_state");
    out.progressMs = jsonInt(root, "progress_ms", 0);

    json_t* device = json_object_get(root, "device");
    if (device && json_is_object(device)) {
        out.device = jsonString(device, "name");
        out.volume = jsonInt(device, "volume_percent", -1);
    }

    json_t* item = json_object_get(root, "item");
    if (item && json_is_object(item)) {
        out.track = jsonString(item, "name");
        out.durationMs = jsonInt(item, "duration_ms", 0);

        json_t* album = json_object_get(item, "album");
        if (album && json_is_object(album)) out.album = jsonString(album, "name");

        json_t* artists = json_object_get(item, "artists");
        if (artists && json_is_array(artists)) {
            const size_t count = json_array_size(artists);
            for (size_t i = 0; i < count; ++i) {
                json_t* artist = json_array_get(artists, i);
                const std::string name = jsonString(artist, "name");
                if (name.empty()) continue;
                if (!out.artists.empty()) out.artists += ", ";
                out.artists += name;
            }
        }
    }

    json_decref(root);
    return true;
}

bool SpotifyClient::getDevices(std::vector<SpotifyDevice>& out) {
    out.clear();
    HttpResponse r = request("GET", std::string(API) + "/me/player/devices", "", "", true);
    if (r.status == 401 && refreshAccessToken()) {
        r = request("GET", std::string(API) + "/me/player/devices", "", "", true);
    }
    if (!ok(r, "Get Spotify devices")) return false;

    json_error_t error{};
    json_t* root = json_loads(r.body.c_str(), 0, &error);
    if (!root) {
        lastError_ = "Device response was invalid JSON";
        return false;
    }

    json_t* devices = json_object_get(root, "devices");
    if (devices && json_is_array(devices)) {
        const size_t count = json_array_size(devices);
        for (size_t i = 0; i < count; ++i) {
            json_t* d = json_array_get(devices, i);
            if (!d || !json_is_object(d)) continue;
            SpotifyDevice device;
            device.id = jsonString(d, "id");
            device.name = jsonString(d, "name");
            device.type = jsonString(d, "type");
            device.volume = jsonInt(d, "volume_percent", -1);
            device.active = jsonBool(d, "is_active");
            device.restricted = jsonBool(d, "is_restricted");
            if (!device.id.empty()) out.push_back(device);
        }
    }
    json_decref(root);
    return true;
}

bool SpotifyClient::play() {
    HttpResponse r = request("PUT", std::string(API) + "/me/player/play", "", "application/json", true);
    return ok(r, "Play");
}

bool SpotifyClient::pause() {
    HttpResponse r = request("PUT", std::string(API) + "/me/player/pause", "", "application/json", true);
    return ok(r, "Pause");
}

bool SpotifyClient::next() {
    HttpResponse r = request("POST", std::string(API) + "/me/player/next", "", "application/json", true);
    return ok(r, "Next track");
}

bool SpotifyClient::previous() {
    HttpResponse r = request("POST", std::string(API) + "/me/player/previous", "", "application/json", true);
    return ok(r, "Previous track");
}

bool SpotifyClient::seek(int positionMs) {
    positionMs = std::max(0, positionMs);
    HttpResponse r = request("PUT", std::string(API) + "/me/player/seek?position_ms=" + std::to_string(positionMs), "", "application/json", true);
    return ok(r, "Seek");
}

bool SpotifyClient::setVolume(int percent) {
    percent = std::max(0, std::min(100, percent));
    HttpResponse r = request("PUT", std::string(API) + "/me/player/volume?volume_percent=" + std::to_string(percent), "", "application/json", true);
    return ok(r, "Set volume");
}

bool SpotifyClient::setShuffle(bool enabled) {
    HttpResponse r = request("PUT", std::string(API) + "/me/player/shuffle?state=" + (enabled ? "true" : "false"), "", "application/json", true);
    return ok(r, "Set shuffle");
}

bool SpotifyClient::transfer(const std::string& deviceId, bool playNow) {
    const std::string body = "{\"device_ids\":[\"" + jsonEscape(deviceId) + "\"],\"play\":" + (playNow ? "true" : "false") + "}";
    HttpResponse r = request("PUT", std::string(API) + "/me/player", body, "application/json", true);
    return ok(r, "Transfer playback");
}
