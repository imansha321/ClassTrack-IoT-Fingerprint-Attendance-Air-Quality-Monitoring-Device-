#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <Preferences.h>

// -------------------- Pins & Interfaces --------------------
HardwareSerial FingerSerial(2); // Serial2
const int MQ135_PIN = 34;       // MQ135 analog pin
#define OLED_I2C_ADDR 0x3C
Adafruit_SH1106G display(128, 64, &Wire, -1);

Adafruit_Fingerprint finger = Adafruit_Fingerprint(&FingerSerial);
uint8_t fingerResult;
int fingerID;
int fingerConfidence;
uint16_t nextEnrollId = 1;

const int ENROLL_BUTTON_PIN = 13;
const int UI_NEXT_PIN = 12;
const int UI_PREV_PIN = 14;
const int ACTION_BUTTON_PIN = 27;
bool enrollRequested = false;
bool autoRotateEnabled = true;
bool enrollInProgress = false;
String homeToast = "";
unsigned long homeToastMs = 0;
const unsigned long HOME_TOAST_DURATION_MS = 2000;

// Debounce
unsigned long lastBtnMs = 0;
const unsigned long BTN_DEBOUNCE_MS = 200;

// WiFi / Backend
Preferences prefs;
String jwtToken = "";
String deviceToken = "";
String deviceId = "DEVICE-001";
String roomName = "Room-1";
// Avoid trailing slash to prevent double slashes when building URLs
const char *serverBase = "https://4e131f99b938.ngrok-free.app";

// Timing
unsigned long lastAQMs = 0;
const unsigned long AQ_INTERVAL_MS = 5000;
unsigned long lastAttendancePostMs = 0;
const unsigned long ATTENDANCE_COOLDOWN_MS = 3000;

// UI
enum UiScreen
{
    UI_HOME,
    UI_WIFI,
    UI_AIR,
    UI_FINGER,
    UI_DEVICE
};
UiScreen currentScreen = UI_HOME;
unsigned long lastUiRotateMs = 0;
const unsigned long UI_ROTATE_MS = 4000;

// -------------------- Function Prototypes --------------------
bool btnPressed(int pin);
void oledHeader(const char *title);
void oledFooter(const char *msg);
void showFingerprintStatus(const char *status, int id = -1, int confidence = -1);
void showAirQuality(int raw);
int readMQ135Raw();
float mq135Percent(int raw);
float mq135PseudoPPM(int raw);
int getFingerprintID();
bool enrollFingerprint(uint16_t id);
void IRAM_ATTR isrEnroll();
void IRAM_ATTR isrNext();
void IRAM_ATTR isrPrev();
void IRAM_ATTR isrAction();
void setupWiFi();
bool fetchToken(const String &email, const String &password);
void postAttendance(uint16_t fingerprintId, int confidence);
void postAirQuality(int raw);
void postDeviceStatus();
void drawHomeScreen();
void drawWifiScreen();
void drawDeviceScreen();
void drawFingerScreenIdle();
void rotateUiIfNeeded();

// -------------------- Helper Functions --------------------
// Interrupt flags
volatile bool enrollIRQ = false;
volatile bool nextIRQ = false;
volatile bool prevIRQ = false;
volatile bool actionIRQ = false;
volatile bool cancelEnrollIRQ = false;

void IRAM_ATTR isrEnroll()
{
    // If already enrolling, treat second press as cancel request
    if (enrollInProgress)
        cancelEnrollIRQ = true;
    else
        enrollIRQ = true;
}
void IRAM_ATTR isrNext() { nextIRQ = true; }
void IRAM_ATTR isrPrev() { prevIRQ = true; }
void IRAM_ATTR isrAction() { actionIRQ = true; }

void oledHeader(const char *title)
{
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.println(title);
    display.drawLine(0, 10, 127, 10, SH110X_WHITE);
}

void oledFooter(const char *msg)
{
    display.setCursor(0, 56);
    display.println(msg);
}

void showFingerprintStatus(const char *status, int id, int confidence)
{
    oledHeader("Fingerprint");
    display.setCursor(0, 16);
    display.print("Status: ");
    display.println(status);
    if (id >= 0)
    {
        display.setCursor(0, 28);
        display.print("ID: ");
        display.println(id);
    }
    if (confidence >= 0)
    {
        display.setCursor(0, 40);
        display.print("Conf: ");
        display.println(confidence);
    }
    oledFooter("Place finger...");
    display.display();
}

void showAirQuality(int raw)
{
    float pct = mq135Percent(raw);
    float ppm = mq135PseudoPPM(raw);
    oledHeader("Air Quality");
    display.setCursor(0, 16);
    display.print("ADC: ");
    display.println(raw);
    display.setCursor(0, 28);
    display.print("Level: ");
    display.print(pct, 1);
    display.println(" %");
    display.setCursor(0, 40);
    display.print("CO2~: ");
    display.print(ppm, 0);
    display.println(" ppm");
    oledFooter("MQ135 reading...");
    display.display();
}

int readMQ135Raw()
{
    return analogRead(MQ135_PIN);
}

float mq135Percent(int raw)
{
    return (raw / 4095.0f) * 100.0f;
}

float mq135PseudoPPM(int raw)
{
    return 350.0f + (raw / 4095.0f) * 700.0f;
}

int getFingerprintID()
{
    fingerResult = finger.getImage();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerResult = finger.image2Tz();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerResult = finger.fingerFastSearch();
    if (fingerResult != FINGERPRINT_OK)
        return -1;
    fingerID = finger.fingerID;
    fingerConfidence = finger.confidence;
    return fingerID;
}

bool enrollFingerprint(uint16_t id)
{
    enrollInProgress = true;
    showFingerprintStatus("ENROLL", id, -1);
    Serial.printf("Starting enrollment for ID %u\n", id);
    while (finger.getImage() != FINGERPRINT_OK)
        delay(50);
    if (cancelEnrollIRQ)
    {
        cancelEnrollIRQ = false;
        enrollInProgress = false;
        Serial.println("Enroll canceled (stage 1)");
        showFingerprintStatus("CANCELLED", -1, -1);
        delay(800);
        return false;
    }
    if (finger.image2Tz(1) != FINGERPRINT_OK)
    {
        Serial.println("image2Tz(1) failed");
        enrollInProgress = false;
        return false;
    }
    // Duplicate check: try searching existing templates after first conversion
    if (finger.fingerFastSearch() == FINGERPRINT_OK)
    {
        // Found a match – do NOT enroll again
        Serial.printf("Duplicate fingerprint detected (ID=%d). Aborting enrollment.\n", finger.fingerID);
        showFingerprintStatus("DUPLICATE", finger.fingerID, finger.confidence);
        delay(1200);
        enrollInProgress = false;
        homeToast = "Already registered";
        homeToastMs = millis();
        currentScreen = UI_HOME;
        drawHomeScreen();
        return false;
    }
    display.setCursor(0, 48);
    display.println("Remove finger");
    display.display();
    while (finger.getImage() != FINGERPRINT_NOFINGER)
        delay(50);
    display.setCursor(0, 48);
    display.println("Place again  ");
    display.display();
    while (finger.getImage() != FINGERPRINT_OK)
        delay(50);
    if (cancelEnrollIRQ)
    {
        cancelEnrollIRQ = false;
        enrollInProgress = false;
        Serial.println("Enroll canceled (stage 2)");
        showFingerprintStatus("CANCELLED", -1, -1);
        delay(800);
        return false;
    }
    if (finger.image2Tz(2) != FINGERPRINT_OK)
    {
        Serial.println("image2Tz(2) failed");
        enrollInProgress = false;
        return false;
    }
    if (finger.createModel() != FINGERPRINT_OK)
    {
        Serial.println("createModel failed");
        enrollInProgress = false;
        return false;
    }
    // Optional second duplicate check before storing (some sensors support model search)
    // If supported, you could load model and compare; here we proceed to store.
    if (finger.storeModel(id) != FINGERPRINT_OK)
    {
        Serial.println("storeModel failed");
        enrollInProgress = false;
        return false;
    }
    Serial.println("Enrollment success!");
    showFingerprintStatus("ENROLLED", id, -1);
    delay(1500);
    enrollInProgress = false;
    return true;
}

void setupWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFiManager wm;
    wm.setTimeout(180);

    // Load previously saved deviceId
    prefs.begin("classtrack", false);
    String savedId = prefs.getString("deviceId", "");
    if (savedId.length() > 0)
    {
        deviceId = savedId;
    }

    // Create custom parameter for deviceId (visible in captive portal)
    WiFiManagerParameter pDevId("deviceId", "Device ID", deviceId.c_str(), 32);
    wm.addParameter(&pDevId);

    // Optional: parameter to provision a device token
    char tokenBuf[180];
    String savedToken = prefs.getString("deviceToken", "");
    savedToken.toCharArray(tokenBuf, sizeof(tokenBuf));
    WiFiManagerParameter pDevToken("deviceToken", "Device Token (JWT)", tokenBuf, sizeof(tokenBuf) - 1);
    wm.addParameter(&pDevToken);

    // Optional: parameter for server base URL
    // char serverBuf[64];
    // strlcpy(serverBuf, serverBase, sizeof(serverBuf));
    // WiFiManagerParameter pServer("serverBase", "Server Base (e.g. http://ip:5000)", serverBuf, 63);
    // wm.addParameter(&pServer);

    // Parameter to set default room name for airquality/device
    WiFiManagerParameter pRoom("room", "Room Name", roomName.c_str(), 32);
    wm.addParameter(&pRoom);

    if (!wm.autoConnect("ClassTrack-Setup"))
    {
        Serial.println("WiFiManager timeout, restarting");
        ESP.restart();
    }

    // Read parameters after connect
    deviceId = String(pDevId.getValue());
    prefs.putString("deviceId", deviceId);

    // Save device token if provided
    deviceToken = String(pDevToken.getValue());
    if (deviceToken.length() > 0)
    {
        prefs.putString("deviceToken", deviceToken);
    }

    // If server parameter enabled, you can parse and store it similarly
    // serverBase = String(pServer.getValue()); // beware const char*; consider storing in Preferences

    // Persist room name
    roomName = String(pRoom.getValue());
    if (roomName.length() == 0)
        roomName = "Room-1";
    prefs.putString("room", roomName);

    Serial.print("Connected. IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Device ID: ");
    Serial.println(deviceId);
    Serial.print("DeviceToken: ");
    Serial.println(deviceToken.isEmpty() ? "(none)" : "(set)");
    Serial.print("Room: ");
    Serial.println(roomName);
}

bool fetchToken(const String &email, const String &password)
{
    if (WiFi.status() != WL_CONNECTED)
        return false;
    HTTPClient http;
    String url = String(serverBase) + "/api/auth/login";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    String body = String("{\"email\":\"") + email + "\",\"password\":\"" + password + "\"}";
    int code = http.POST(body);
    if (code == 200)
    {
        String res = http.getString();
        int tIdx = res.indexOf("\"token\":\"");
        if (tIdx >= 0)
        {
            int start = tIdx + 10;
            int end = res.indexOf("\"", start);
            jwtToken = res.substring(start, end);
            Serial.println("JWT acquired");
            prefs.putString("jwt", jwtToken);
            http.end();
            return true;
        }
    }
    Serial.printf("Login failed code=%d\n", code);
    http.end();
    return false;
}

void postAttendance(uint16_t fingerprintId, int confidence)
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    if (millis() - lastAttendancePostMs < ATTENDANCE_COOLDOWN_MS)
        return;
    lastAttendancePostMs = millis();
    HTTPClient http;
    String url = String(serverBase) + "/api/attendance/device";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (!deviceToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + deviceToken);
    else if (!jwtToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + jwtToken);
    // Map fingerprint ID to studentId (string). fingerprintMatch true, reliability from confidence
    String payload = String("{\"studentId\":\"") + fingerprintId + "\",\"fingerprintMatch\":true,\"reliability\":" + confidence + "}";
    int code = http.POST(payload);
    Serial.printf("Attendance POST code=%d\n", code);
    http.end();
}

void postAirQuality(int raw)
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/airquality/device";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (!deviceToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + deviceToken);
    else if (!jwtToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + jwtToken);
    float pct = mq135Percent(raw);
    float ppm = mq135PseudoPPM(raw);
    float pm25 = pct * 0.8f;   // rough scaling
    float co2 = ppm;           // pseudo ppm
    float temperature = 25.0f; // placeholder
    float humidity = 50.0f;    // placeholder
    String payload = String("{\"room\":\"") + roomName + "\",\"pm25\":" + pm25 + ",\"co2\":" + co2 + ",\"temperature\":" + temperature + ",\"humidity\":" + humidity + "}";
    int code = http.POST(payload);
    Serial.printf("AirQuality POST code=%d\n", code);
    http.end();
}

// -------------------- POST Device Status/Heartbeat --------------------
void postDeviceStatus()
{
    if (WiFi.status() != WL_CONNECTED)
        return;
    HTTPClient http;
    String url = String(serverBase) + "/api/devices/status";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    if (!deviceToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + deviceToken);
    else if (!jwtToken.isEmpty())
        http.addHeader("Authorization", String("Bearer ") + jwtToken);
    int rssi = WiFi.RSSI();
    int battery = 95;
    String payload = String("{\"deviceId\":\"") + deviceId + "\",\"signal\":" + rssi + ",\"battery\":" + battery + ",\"status\":\"online\"}";
    int code = http.POST(payload);
    Serial.printf("Device status POST code=%d\n", code);
    http.end();
}

void drawHomeScreen()
{
    oledHeader("ClassTrack Device");
    display.setCursor(0, 16);
    display.println("Ready.");
    display.setCursor(0, 28);
    display.println("Enroll: BTN13  Next:12 Prev:14");
    display.setCursor(0, 40);
    display.print("IP: ");
    display.println(WiFi.isConnected() ? WiFi.localIP().toString() : "--");
    if (!homeToast.isEmpty() && (millis() - homeToastMs) < HOME_TOAST_DURATION_MS)
    {
        oledFooter(homeToast.c_str());
    }
    else
    {
        oledFooter("Auto-rotate screens");
        homeToast = "";
    }
    display.display();
}

void drawWifiScreen()
{
    oledHeader("WiFi Status");
    display.setCursor(0, 16);
    display.print("SSID: ");
    display.println(WiFi.SSID());
    display.setCursor(0, 28);
    display.print("IP: ");
    display.println(WiFi.isConnected() ? WiFi.localIP().toString() : "--");
    display.setCursor(0, 40);
    display.print("JWT: ");
    display.println(jwtToken.isEmpty() ? "no" : "ok");
    display.setCursor(64, 40);
    display.print("DevTok: ");
    display.println(deviceToken.isEmpty() ? "no" : "ok");
    oledFooter("Portal: ClassTrack-Setup");
    display.display();
}

void drawDeviceScreen()
{
    oledHeader("Device Info");
    display.setCursor(0, 16);
    display.print("ID: ");
    display.println(deviceId);
    display.setCursor(0, 28);
    display.print("EnrollID: ");
    display.println(nextEnrollId);
    display.setCursor(0, 40);
    display.print("Server: ");
    display.println(serverBase);
    oledFooter("Press BTN13 to enroll");
    display.display();
}

void drawFingerScreenIdle()
{
    showFingerprintStatus("SCAN");
}

void rotateUiIfNeeded()
{
    unsigned long now = millis();
    if (!autoRotateEnabled)
        return;
    if (now - lastUiRotateMs < UI_ROTATE_MS)
        return;
    lastUiRotateMs = now;

    switch (currentScreen)
    {
    case UI_HOME:
        currentScreen = UI_WIFI;
        break;
    case UI_WIFI:
        currentScreen = UI_AIR;
        break;
    case UI_AIR:
        currentScreen = UI_FINGER;
        break;
    case UI_FINGER:
        currentScreen = UI_DEVICE;
        break;
    case UI_DEVICE:
        currentScreen = UI_HOME;
        break;
    }

    if (currentScreen == UI_HOME)
        drawHomeScreen();
    else if (currentScreen == UI_WIFI)
        drawWifiScreen();
    else if (currentScreen == UI_AIR)
        showAirQuality(readMQ135Raw());
    else if (currentScreen == UI_FINGER)
        drawFingerScreenIdle();
    else if (currentScreen == UI_DEVICE)
        drawDeviceScreen();
}

// Advance UI state machine by a step (+1 next, -1 prev) and render immediately
void advanceUi(int step)
{
    autoRotateEnabled = false; // user-driven navigation
    // compute next state
    int total = 5; // number of screens
    int next = (int)currentScreen + step;
    while (next < 0)
        next += total;
    next = next % total;
    currentScreen = (UiScreen)next;
    // render corresponding screen
    if (currentScreen == UI_HOME)
        drawHomeScreen();
    else if (currentScreen == UI_WIFI)
        drawWifiScreen();
    else if (currentScreen == UI_AIR)
        showAirQuality(readMQ135Raw());
    else if (currentScreen == UI_FINGER)
        drawFingerScreenIdle();
    else if (currentScreen == UI_DEVICE)
        drawDeviceScreen();
}

// -------------------- Setup --------------------
void setup()
{
    Serial.begin(115200);
    delay(200);
    Serial.println("ESP32 + R307 + MQ135 + SH1106");

    analogReadResolution(12);
    Wire.begin();
    if (!display.begin(OLED_I2C_ADDR, true))
        Serial.println("SH1106 init failed!");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(0, 0);
    display.println("Initializing...");
    display.display();

    FingerSerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);
    delay(200);
    if (finger.verifyPassword())
        Serial.println("Fingerprint sensor found!");
    else
        Serial.println("Fingerprint sensor NOT found");

    setupWiFi();

    prefs.begin("classtrack", false);
    jwtToken = prefs.getString("jwt", "");
    deviceToken = prefs.getString("deviceToken", "");
    if (jwtToken.isEmpty())
        fetchToken("admin@example.com", "CHANGE_ME");

    pinMode(ENROLL_BUTTON_PIN, INPUT_PULLUP);
    pinMode(UI_NEXT_PIN, INPUT_PULLUP);
    pinMode(UI_PREV_PIN, INPUT_PULLUP);
    pinMode(ACTION_BUTTON_PIN, INPUT_PULLUP);

    // Attach interrupts on falling edge (button to GND)
    attachInterrupt(digitalPinToInterrupt(ENROLL_BUTTON_PIN), isrEnroll, FALLING);
    attachInterrupt(digitalPinToInterrupt(UI_NEXT_PIN), isrNext, FALLING);
    attachInterrupt(digitalPinToInterrupt(UI_PREV_PIN), isrPrev, FALLING);
    attachInterrupt(digitalPinToInterrupt(ACTION_BUTTON_PIN), isrAction, FALLING);

    for (uint16_t testId = 1; testId < 200; ++testId)
    {
        if (finger.loadModel(testId) != FINGERPRINT_OK)
        {
            nextEnrollId = testId;
            break;
        }
    }

    drawHomeScreen();
}

// -------------------- Loop --------------------
void loop()
{
    // Handle interrupt-driven buttons with debounce in main loop
    unsigned long now = millis();

    // Enrollment button
    if (enrollIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS && !enrollRequested)
    {
        lastBtnMs = now;
        enrollIRQ = false;
        enrollRequested = true;
        Serial.println("Enroll button pressed");
        if (enrollFingerprint(nextEnrollId))
            nextEnrollId++;
        enrollRequested = false;
    }

    // Handle cancel request during enrollment
    if (cancelEnrollIRQ && enrollInProgress)
    {
        // Flag is consumed in enrollFingerprint checks; here just ensure UI feedback
        // No action needed; keep debounce timestamp fresh
        lastBtnMs = now;
    }

    // UI buttons
    if (nextIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS)
    {
        lastBtnMs = now;
        nextIRQ = false;
        autoRotateEnabled = false;
        currentScreen = (UiScreen)((currentScreen + 1) % 5);
        rotateUiIfNeeded();
    }
    if (nextIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS)
    {
        lastBtnMs = now;
        nextIRQ = false;
        advanceUi(+1);
    }
    if (prevIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS)
    {
        lastBtnMs = now;
        prevIRQ = false;
        advanceUi(-1);
    }
    if (actionIRQ && (now - lastBtnMs) > BTN_DEBOUNCE_MS)
    {
        lastBtnMs = now;
        actionIRQ = false;
        // Context refresh for current screen
        if (currentScreen == UI_AIR)
            showAirQuality(readMQ135Raw());
        else if (currentScreen == UI_WIFI)
            drawWifiScreen();
        else if (currentScreen == UI_DEVICE)
            drawDeviceScreen();
        else if (currentScreen == UI_FINGER)
            drawFingerScreenIdle();
        else
            drawHomeScreen();
    }
    if (now - lastAQMs >= AQ_INTERVAL_MS)
    {
        lastAQMs = now;
        int raw = readMQ135Raw();
        Serial.printf("MQ135 raw=%d\n", raw);
        if (currentScreen == UI_AIR)
            showAirQuality(raw);
        postAirQuality(raw);
        // Send a heartbeat periodically so UI shows the device
        postDeviceStatus();
    }

    // Fingerprint scan
    int id = getFingerprintID();
    if (id >= 0)
    {
        Serial.printf("Fingerprint ID=%d conf=%d\n", id, fingerConfidence);
        currentScreen = UI_FINGER;
        showFingerprintStatus("MATCH", id, fingerConfidence);
        postAttendance(id, fingerConfidence);
        delay(1500);
    }
    else
        delay(100);
}
