#pragma once

#include <string>
#include <vector>

struct SpotifyConfig {
    std::string clientId;
    std::string refreshToken;
};

struct PlaybackState {
    bool valid = false;
    bool isPlaying = false;
    bool shuffle = false;
    std::string repeatState = "off";
    std::string track;
    std::string artists;
    std::string album;
    std::string device;
    int progressMs = 0;
    int durationMs = 0;
    int volume = -1;
};

struct SpotifyDevice {
    std::string id;
    std::string name;
    std::string type;
    int volume = -1;
    bool active = false;
    bool restricted = false;
};

class SpotifyClient {
public:
    bool loadConfig(const std::string& path);
    bool refreshAccessToken();
    bool getPlayback(PlaybackState& out);
    bool getDevices(std::vector<SpotifyDevice>& out);

    bool play();
    bool pause();
    bool next();
    bool previous();
    bool seek(int positionMs);
    bool setVolume(int percent);
    bool setShuffle(bool enabled);
    bool transfer(const std::string& deviceId, bool playNow);

    const std::string& lastError() const { return lastError_; }
    bool ready() const { return !accessToken_.empty(); }

private:
    struct HttpResponse {
        long status = 0;
        std::string body;
        std::string curlError;
    };

    HttpResponse request(const std::string& method,
                         const std::string& url,
                         const std::string& body = "",
                         const std::string& contentType = "application/json",
                         bool useAuth = true);
    bool ok(const HttpResponse& r, const char* action);
    void setApiError(const HttpResponse& r, const char* action);

    SpotifyConfig config_;
    std::string configPath_;
    std::string accessToken_;
    std::string lastError_;
};
