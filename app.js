{
const rootEl = document.getElementById('root');
if (!window.React || !window.ReactDOM) {
  rootEl.textContent = 'Could not load React from the CDN. Check the connection and reload the page.';
} else {
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const h = React.createElement;

/* ---------- geometry ---------- */
const ESP_W = 290, ESP_HEAD = 52, ROW = 22, CW = 228, C_HEAD = 50, PROW = 24, FW = 216, FH = 92;
const ESP_X = 0, ESP_Y = 120;

/* ---------- ESP32 DevKitC 38-pin, physical order top to bottom ---------- */
const LEFT = [['3V3','3V3','pwr'],['EN','EN','avoid'],['VP','36'],['VN','39'],['34','34'],['35','35'],['32','32'],['33','33'],['25','25'],['26','26'],['27','27'],['14','14'],['12','12','spare'],['GND','GND','gnd'],['13','13'],['SD2','9','avoid'],['SD3','10','avoid'],['CMD','11','avoid'],['5V','5V','pwr']];
const RIGHT = [['GND','GND','gnd'],['23','23'],['22','22'],['TX0','1','avoid'],['RX0','3','avoid'],['21','21'],['GND','GND','gnd'],['19','19'],['18','18'],['5','5'],['17','17'],['16','16'],['4','4'],['0','0'],['2','2'],['15','15'],['SD1','8','avoid'],['SD0','7','avoid'],['CLK','6','avoid']];
const pinStatus = p => p[2] || 'used';
function espPort(gpio, pos) {
  const e = pos.esp;
  let i = LEFT.findIndex(p => p[1] === gpio);
  if (i >= 0) return { x: e.x, y: e.y + ESP_HEAD + i * ROW + ROW / 2, dir: -1 };
  i = RIGHT.findIndex(p => p[1] === gpio);
  return { x: e.x + ESP_W, y: e.y + ESP_HEAD + i * ROW + ROW / 2, dir: 1 };
}

/* ---------- wiring parts ---------- */
const COMPS = [
  { id:'slotir', t:'Slot IR sensors ×4', s:'FC-51 · P1–P4 · 3.3 V', side:'L', x:-470, y:0, c:'#e04f5f', v:'3v3', ports:[['P1 OUT','36'],['P2 OUT','39'],['P3 OUT','32'],['P4 OUT','33']] },
  { id:'mq2', t:'MQ-2 gas sensor', s:'5 V heater · AO via divider', side:'L', x:-470, y:176, c:'#7aa52a', v:'5v', ports:[['AO ÷ 1k/2k','34']] },
  { id:'us', t:'HC-SR04 ultrasonic', s:'Entry gate · car detect · 5 V', side:'L', x:-470, y:280, c:'#13a8a8', v:'5v', ports:[['ECHO ÷ 1k/2k','35'],['TRIG','23']] },
  { id:'buzzer', t:'Buzzer', s:'Active buzzer module · 3.3 V', side:'L', x:-470, y:408, c:'#8a96a3', v:'3v3', ports:[['I/O','25']] },
  { id:'pir', t:'PIR motion (HC-SR501)', s:'5 V supply · 3.3 V output', side:'L', x:-470, y:512, c:'#e05aa8', v:'5v', ports:[['OUT','26']] },
  { id:'irexit', t:'Exit IR sensor', s:'FC-51 at exit gate · 3.3 V', side:'L', x:-470, y:616, c:'#ff7a59', v:'3v3', ports:[['OUT','27']] },
  { id:'servoexit', t:'Servo SG90 — exit', s:'Exit barrier · 5 V supply', side:'L', x:-470, y:720, c:'#b9770e', v:'5v', ports:[['Signal','14']] },
  { id:'servoentry', t:'Servo SG90 — entry', s:'Entry barrier · 5 V supply', side:'L', x:-470, y:824, c:'#f2994a', v:'5v', ports:[['Signal','13']] },
  { id:'lcd', t:'LCD 16×2 + I2C backpack', s:'Address 0x27 or 0x3F · 5 V', side:'R', x:500, y:100, c:'#2f80ed', v:'5v', ports:[['SCL','22'],['SDA','21']] },
  { id:'keypad', t:'Keypad 4×4', s:'Passive matrix · no power pin', side:'R', x:500, y:250, c:'#9b51e0', v:null, ports:[['C1','19'],['C2','18'],['C3','5'],['R1','17'],['R2','16'],['R3','4'],['R4','0'],['C4','2']] },
  { id:'light', t:'Garage light LED', s:'220 Ω series resistor', side:'R', x:500, y:540, c:'#d9a400', v:'gnd', ports:[['Anode (+)','15']] }
];
const PSU = { id:'psu', x:10, y:960, w:270, h:64 };
const compH = c => C_HEAD + c.ports.length * PROW + 10;

/* ---------- logic graph ---------- */
const LOGIC = {
  lanes: [
    { x:-580, y:-70, t:'Entry flow', s:'Main control loop · core 1' },
    { x:1250, y:180, t:'Exit lane', s:'Runs every loop' },
    { x:1250, y:800, t:'Lighting', s:'Runs every loop' },
    { x:1550, y:180, t:'Gas safety', s:'Every 500 ms' },
    { x:1550, y:800, t:'Network', s:'Separate FreeRTOS task' }
  ],
  nodes: [
    { id:'boot', k:'start', x:0, y:0, t:'Boot & warm-up', s:'Wi-Fi, gates closed, MQ-2 warm-up 60 s' },
    { id:'idle', k:'act', x:0, y:130, t:'Idle — monitoring', s:'LCD shows free spaces' },
    { id:'detect', k:'dec', x:0, y:260, t:'Car at entry?', s:'Ultrasonic < 8 cm' },
    { id:'prompt', k:'act', x:0, y:390, t:'Prompt driver', s:'“A = walk-in · PIN + #”' },
    { id:'key', k:'dec', x:0, y:520, t:'Which input?', s:'Keypad 4×4' },
    { id:'walk', k:'dec', x:-320, y:660, t:'Walk-in space left?', s:'free − active bookings > 0' },
    { id:'fullMsg', k:'alarm', x:-580, y:800, t:'Show “Garage FULL”', s:'Gate stays closed · short beep' },
    { id:'verify', k:'dec', x:300, y:660, t:'PIN matches a booking?', s:'Active & not expired' },
    { id:'assign', k:'act', x:300, y:800, t:'Booking matched', s:'LCD “Go to slot P2” · mark arrived' },
    { id:'attempts', k:'dec', x:600, y:800, t:'Attempts < 3?', s:'Counter per car' },
    { id:'lockout', k:'alarm', x:900, y:800, t:'Lock keypad 30 s', s:'Event sent to dashboard' },
    { id:'openEntry', k:'act', x:0, y:940, t:'Open entry gate', s:'Servo 1 → 90°' },
    { id:'passed', k:'dec', x:0, y:1070, t:'Car passed?', s:'Ultrasonic clear for 2 s' },
    { id:'closeEntry', k:'act', x:0, y:1200, t:'Close entry gate', s:'Servo 1 → 0°' },
    { id:'slotUpd', k:'act', x:0, y:1330, t:'Slot sensor changes', s:'Debounce 300 ms → sync to cloud' },
    { id:'exitDet', k:'dec', x:1250, y:260, t:'Exit IR blocked?', s:'Car waiting at exit' },
    { id:'openExit', k:'act', x:1250, y:390, t:'Open exit gate', s:'Servo 2 → 90°' },
    { id:'exitClear', k:'dec', x:1250, y:520, t:'Exit clear 2 s?', s:'IR back to HIGH' },
    { id:'closeExit', k:'act', x:1250, y:650, t:'Close exit gate', s:'Log exit event' },
    { id:'pirDet', k:'dec', x:1250, y:880, t:'Motion detected?', s:'PIR HIGH' },
    { id:'lightOn', k:'act', x:1250, y:1010, t:'Lights on', s:'Restart 30 s timer' },
    { id:'lightTimer', k:'dec', x:1250, y:1140, t:'30 s without motion?', s:'millis() timer' },
    { id:'lightOff', k:'act', x:1250, y:1270, t:'Lights off', s:'Saves energy' },
    { id:'gasRead', k:'act', x:1550, y:260, t:'Read MQ-2', s:'analogRead(34)' },
    { id:'gasDec', k:'dec', x:1550, y:390, t:'Above threshold 3× in a row?', s:'Baseline + margin' },
    { id:'emergency', k:'alarm', x:1550, y:520, t:'EMERGENCY mode', s:'Siren · exit open · entry locked · alert' },
    { id:'gasClear', k:'dec', x:1550, y:650, t:'Below threshold 10 s?', s:'Then back to normal' },
    { id:'net', k:'start', x:1550, y:880, w:260, t:'Network task · core 0', s:'POST state on every change + heartbeat 10 s · pulls active bookings' }
  ],
  edges: [
    ['boot','idle'],['idle','detect'],['detect','idle','no','R'],['detect','prompt','yes'],['prompt','key'],
    ['key','walk','A'],['key','verify','digits + #'],['walk','openEntry','yes'],['walk','fullMsg','no'],['fullMsg','idle','car leaves','side'],
    ['verify','assign','yes'],['verify','attempts','no'],['attempts','prompt','yes · retry','side'],['attempts','lockout','no'],['lockout','prompt','after 30 s','side'],
    ['assign','openEntry'],['openEntry','passed'],['passed','closeEntry','yes'],['closeEntry','slotUpd'],['slotUpd','idle','loop','L'],
    ['exitDet','openExit','yes'],['openExit','exitClear'],['exitClear','closeExit','yes'],['closeExit','exitDet','loop','R'],
    ['pirDet','lightOn','yes'],['lightOn','lightTimer'],['lightTimer','lightOff','yes'],['lightOff','pirDet','loop','R'],
    ['gasRead','gasDec'],['gasDec','gasRead','no','R'],['gasDec','emergency','yes'],['emergency','gasClear'],['gasClear','gasRead','yes','L']
  ]
};

const SCENARIOS = [
  { id:'reserved', t:'Driver with a booking', steps:[
    ['idle','LCD idles on “PARKORA · Free 2 of 4” (2 free, 1 of them booked for this driver).'],
    ['detect','The car stops in front of the barrier — the ultrasonic reads 6 cm.'],
    ['prompt','LCD: “Welcome! Free:1” / “A=Walk-in PIN+#”.'],
    ['key','Driver types 4821 and presses #.'],
    ['verify','ESP32 hashes the PIN and finds the active booking for slot P2.'],
    ['assign','LCD: “Booking OK” / “Go to slot P2”. The booking is marked arrived.'],
    ['openEntry','Entry servo turns to 90°.'],
    ['passed','Ultrasonic reads clear for 2 seconds — the car is through.'],
    ['closeEntry','Entry servo back to 0°.'],
    ['slotUpd','P2 sensor goes LOW, P2 LED turns red, dashboard shows P2 occupied within ~1 s.'] ] },
  { id:'walkin', t:'Walk-in (no booking)', steps:[
    ['idle','2 free slots, 1 booked by someone else → 1 slot for walk-ins.'],
    ['detect','Car detected at the entry.'],
    ['prompt','LCD: “Welcome! Free:1” / “A=Walk-in PIN+#”.'],
    ['key','Driver presses A.'],
    ['walk','free (2) − active bookings (1) = 1 > 0 → allowed. LCD lists the free, unbooked slot.'],
    ['openEntry','Entry gate opens.'],
    ['passed','Car passes the barrier.'],
    ['closeEntry','Gate closes.'],
    ['slotUpd','The walk-in parks; the slot turns occupied on the dashboard.'] ] },
  { id:'full', t:'Garage full', steps:[
    ['idle','All 4 slots are occupied or booked.'],
    ['detect','Car detected at the entry.'],
    ['prompt','LCD shows “Free:0”.'],
    ['key','Driver presses A anyway.'],
    ['walk','free − bookings = 0 → refused.'],
    ['fullMsg','LCD: “Garage FULL” / “Sorry, no space”. Short beep, barrier stays down.'],
    ['idle','When the car backs away the system returns to idle.'] ] },
  { id:'wrongpin', t:'Wrong PIN three times', steps:[
    ['prompt','Driver is asked for a PIN.'],
    ['key','Types 1111 #.'],
    ['verify','No active booking has this PIN.'],
    ['attempts','Attempt 1 of 3 → LCD “Wrong PIN (1/3)” and a triple beep.'],
    ['prompt','Asked again.'],
    ['key','Third wrong try.'],
    ['verify','Still no match.'],
    ['attempts','Attempts reached 3.'],
    ['lockout','Keypad locked 30 s, LCD “Locked 30s”, a pin_fail event appears on the dashboard.'],
    ['prompt','After 30 s the driver can try again.'] ] },
  { id:'exit', t:'Car leaving', steps:[
    ['exitDet','Car reaches the exit, IR output goes LOW.'],
    ['openExit','Exit servo opens. No PIN needed to leave.'],
    ['exitClear','IR clear for 2 s.'],
    ['closeExit','Exit servo closes; an exit event is logged. The slot it left already turned free on its own sensor.'] ] },
  { id:'gas', t:'Smoke / gas alarm', steps:[
    ['gasRead','MQ-2 is sampled every 500 ms (baseline ≈ 900 after warm-up).'],
    ['gasDec','Three readings in a row above 1300.'],
    ['emergency','Siren on, all LEDs flash, exit gate opens for evacuation, entry is locked, LCD “!! GAS ALERT !!”, POST /api/device/alert → Telegram message + red banner on the dashboard.'],
    ['gasClear','Readings stay under the threshold for 10 s.'],
    ['gasRead','Back to normal; the alert stays on the dashboard until someone acknowledges it.'] ] }
];

/* ---------- data-flow graph ---------- */
const DATA = {
  lanes: [
    { x:620, y:-250, t:'Vercel · Node.js API', s:'Serverless functions in /api' },
    { x:990, y:-250, t:'Supabase', s:'Postgres + Realtime' }
  ],
  nodes: [
    { id:'sensors', k:'act', x:-40, y:0, t:'Sensors & keypad', s:'IR ×5, HC-SR04, PIR, MQ-2, keypad' },
    { id:'fw', k:'start', x:290, y:0, t:'ESP32 firmware', s:'Control core 1 · network core 0' },
    { id:'apiSync', k:'act', x:620, y:-150, t:'POST /api/device/sync', s:'State in → active bookings out' },
    { id:'apiEvent', k:'act', x:620, y:0, t:'POST /api/device/event', s:'Entry, exit, PIN fail, full' },
    { id:'apiAlert', k:'alarm', x:620, y:150, t:'POST /api/device/alert', s:'Gas emergency' },
    { id:'db', k:'start', x:990, y:0, t:'Postgres tables', s:'slots · reservations · events · alerts · device' },
    { id:'tg', k:'ext', x:990, y:190, t:'Telegram bot', s:'Push message to staff phone' },
    { id:'rt', k:'act', x:1320, y:0, t:'Supabase Realtime', s:'Pushes row changes' },
    { id:'dash', k:'start', x:1650, y:0, t:'React dashboard', s:'Live slots, bookings, alerts' },
    { id:'driver', k:'ext', x:1650, y:260, t:'Driver / operator', s:'Opens the website' },
    { id:'apiRes', k:'act', x:1320, y:260, t:'POST /api/reservations', s:'Book a slot → PIN' }
  ],
  edges: [
    ['sensors','fw','readings'],['fw','apiSync','state JSON'],['apiSync','fw','bookings (PIN hashes)'],['fw','apiEvent','events'],['fw','apiAlert','gas!'],
    ['apiSync','db','upsert'],['apiEvent','db','insert'],['apiAlert','db','insert'],['apiAlert','tg','notify'],
    ['db','rt','changes'],['rt','dash','websocket'],['driver','dash','uses'],['dash','apiRes','book'],['apiRes','db','insert booking']
  ]
};

/* ---------- detail content ---------- */
const D = {
esp:{ t:'ESP32 DevKitC · 38-pin', sum:'The brain of the garage. One FreeRTOS task (core 1) runs the control loop — sensors, gates, LCD, keypad. A second task (core 0) talks to the Vercel API, so a slow HTTP request never freezes the keypad or a gate.',
  kv:[['Usable GPIO','24 (20 I/O + 4 input-only)'],['Used','23 · spare: GPIO12'],['Power','5V pin from the supply, or USB while coding'],['Logic level','3.3 V — no pin is 5 V tolerant']],
  watch:['Check the metal shield says WROOM-32. On WROVER modules GPIO16/17 belong to PSRAM, and keypad R1/R2 would have to move.','Every 5 V output (HC-SR04 ECHO, MQ-2 AO) goes through a 1 kΩ / 2 kΩ divider before it touches a pin.','GPIO0 is keypad R4 and also the BOOT button: don’t hold keys while powering on.','Never use delay() in loop() — every part of the loop uses millis() timers.'],
  code:`// core 1 = control · core 0 = network
QueueHandle_t netQ;

void setup() {
  Serial.begin(115200);
  initPins(); initLcd(); initGates();
  netQ = xQueueCreate(16, sizeof(NetMsg));
  xTaskCreatePinnedToCore(netTask, "net", 8192, NULL, 1, NULL, 0);
  warmUpGas();                 // 60 s, LCD shows a countdown
}

void loop() {                  // no delay() in here
  readSlots();   entryGate();  exitGate();
  handleKeypad(); lighting();  gasMonitor();
  renderLcd();
}` },
slotir:{ t:'Slot IR sensors (P1–P4)', sum:'One FC-51 module faces down into each bay. Its output goes LOW when the car model is under it.',
  kv:[['P1 · P2','GPIO36 (VP) · GPIO39 (VN)'],['P3 · P4','GPIO32 · GPIO33'],['Power','3V3 rail (keeps the output at 3.3 V)'],['Logic','LOW = occupied']],
  watch:['Slot LED with zero GPIO: a red LED + 1 kΩ from 3V3 to each sensor OUT. When the sensor pulls OUT low the LED lights — it follows the slot in hardware.','Turn the blue trimmer until the module’s own LED switches at about 2–3 cm from the car.','GPIO36/39 are input-only with no internal pull-up; the module’s own pull-up is enough.'],
  code:`const uint8_t SLOT_PIN[4] = {36, 39, 32, 33};
bool occupied[4];

void readSlots() {
  static uint32_t since[4];
  for (int i = 0; i < 4; i++) {
    bool now = digitalRead(SLOT_PIN[i]) == LOW;
    if (now != occupied[i]) {
      if (!since[i]) since[i] = millis();
      if (millis() - since[i] > 300) {      // 300 ms debounce
        occupied[i] = now; since[i] = 0; queueSync();
      }
    } else since[i] = 0;
  }
}` },
mq2:{ t:'MQ-2 gas & smoke sensor', sum:'Detects smoke and flammable gas (LPG, propane, methane). Its analog output rises as gas concentration rises.',
  kv:[['AO','GPIO34 through 1 kΩ / 2 kΩ divider'],['Heater','5 V rail, ~150 mA'],['Sampling','every 500 ms'],['Alarm','3 readings in a row above threshold']],
  watch:['Brand-new sensors need a burn-in: leave it powered for several hours before calibrating.','Every boot it needs ~60 s of warm-up; gas readings are ignored during that time.','Must be on ADC1 (GPIO32–39). ADC2 stops working while Wi-Fi is on.','Test with an unlit lighter’s gas near the sensor — never an open flame on the model.'],
  code:`const int MQ_PIN = 34;
int baseline, threshold;

void calibrateGas() {          // call once in setup, after warm-up
  analogSetPinAttenuation(MQ_PIN, ADC_11db);
  long s = 0;
  for (int i = 0; i < 20; i++) { s += analogRead(MQ_PIN); delay(50); }
  baseline = s / 20;
  threshold = baseline + 400;  // tune with the real sensor
}

void gasMonitor() {
  static uint32_t t; static uint8_t hits;
  if (millis() - t < 500) return;
  t = millis();
  int v = analogRead(MQ_PIN);
  hits = (v > threshold) ? hits + 1 : 0;
  if (hits >= 3 && !emergency) startEmergency(v);
}` },
us:{ t:'HC-SR04 ultrasonic (entry)', sum:'Mounted just before the entry barrier, facing the lane. It tells the system a car is waiting, and later that the car has passed.',
  kv:[['TRIG','GPIO23 (3.3 V trigger is enough)'],['ECHO','GPIO35 through 1 kΩ / 2 kΩ divider'],['Power','5 V rail'],['Thresholds','car < 8 cm · clear > 12 cm']],
  watch:['ECHO outputs 5 V: 1 kΩ from ECHO to GPIO35, 2 kΩ from GPIO35 to GND (5 V × 2/3 ≈ 3.3 V).','Use a pulseIn timeout of 25 ms so a missing echo never stalls the loop.','Different “car” and “clear” distances (hysteresis) stop the barrier twitching at the edge.'],
  code:`const int TRIG = 23, ECHO = 35;

float readCm() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 25000);  // 25 ms timeout
  return us ? us / 58.0 : 999;
}

bool carAtEntry() {
  static bool car = false;
  float d = readCm();
  if (!car && d < 8)  car = true;
  if (car  && d > 12) car = false;
  return car;
}` },
buzzer:{ t:'Buzzer', sum:'Audio feedback and the gas siren.',
  kv:[['I/O','GPIO25'],['Power','3V3 rail'],['Patterns','1 short = key / full · 3 short = wrong PIN · 1 Hz siren = gas']],
  watch:['A buzzer module (with its own transistor) is safest. A bare buzzer on a GPIO must stay under ~20 mA.'],
  code:`const int BUZ = 25;
void beep(int ms) { digitalWrite(BUZ, HIGH); beepUntil = millis() + ms; }
void buzzerTick() {                        // call from loop()
  if (emergency) digitalWrite(BUZ, (millis() / 500) % 2);
  else if (millis() > beepUntil) digitalWrite(BUZ, LOW);
}` },
pir:{ t:'PIR motion sensor (HC-SR501)', sum:'Switches the garage light on when someone moves, and off again after 30 s without motion.',
  kv:[['OUT','GPIO26 (output is 3.3 V — direct)'],['Power','5 V rail on VCC'],['Hold time','30 s, handled in code']],
  watch:['Set the jumper to H (retrigger), time trimmer fully anticlockwise (~3 s), sensitivity in the middle.','After power-up it needs ~60 s to settle and may fire randomly in that time.'],
  code:`const int PIR = 26, LIGHT = 15;
uint32_t lastMotion;

void lighting() {
  if (digitalRead(PIR) == HIGH) lastMotion = millis();
  bool on = emergency || (millis() - lastMotion < 30000);
  digitalWrite(LIGHT, on);
}` },
irexit:{ t:'Exit IR sensor', sum:'Sits at the exit barrier. Leaving needs no PIN: when a car blocks the sensor the exit gate opens.',
  kv:[['OUT','GPIO27'],['Power','3V3 rail'],['Logic','LOW = car at exit']],
  watch:['Point it across the lane at bumper height of the model, not down at the floor.'],
  code:`void exitGate() {
  static uint32_t clearSince;
  bool car = digitalRead(27) == LOW;
  if (car) { exitServo.write(90); clearSince = 0; }
  else if (exitServo.read() == 90) {
    if (!clearSince) clearSince = millis();
    if (millis() - clearSince > 2000) { exitServo.write(0); logEvent("exit"); }
  }
}` },
servoexit:{ t:'Servo SG90 — exit barrier', sum:'Lifts the exit barrier.',
  kv:[['Signal','GPIO14'],['Power','5 V rail (external supply)'],['Angles','closed 0° · open 90°']],
  watch:['Never power a servo from the ESP32 3V3 pin — spikes reset the board.','Supply GND and ESP32 GND must be joined or the servo jitters wildly.'],
  code:`#include <ESP32Servo.h>
Servo exitServo;
void initExit() { exitServo.attach(14, 500, 2400); exitServo.write(0); }` },
servoentry:{ t:'Servo SG90 — entry barrier', sum:'Lifts the entry barrier after a valid PIN or an allowed walk-in, and drops it once the car has passed.',
  kv:[['Signal','GPIO13'],['Power','5 V rail (external supply)'],['Angles','closed 0° · open 90°']],
  watch:['If it buzzes at rest, detach() after each move and attach() again before the next.','Use the same mechanical stop for both servos so 0° means “down” on both.'],
  code:`enum Gate { G_IDLE, G_OPEN, G_WAIT_CLEAR };
Gate gate = G_IDLE; uint32_t clearSince;

void openEntry() { entryServo.write(90); gate = G_OPEN; }

void entryGate() {
  bool car = carAtEntry();
  if (gate == G_OPEN && !car) { gate = G_WAIT_CLEAR; clearSince = millis(); }
  if (gate == G_WAIT_CLEAR) {
    if (car) gate = G_OPEN;                       // still passing
    else if (millis() - clearSince > 2000) { entryServo.write(0); gate = G_IDLE; }
  }
}` },
lcd:{ t:'LCD 16×2 with I2C backpack', sum:'Talks to the driver at the gate: free spaces, prompts, results, alarms.',
  kv:[['SDA · SCL','GPIO21 · GPIO22'],['Power','5 V rail'],['Address','0x27 (some are 0x3F — run an I2C scanner)']],
  watch:['The backpack’s pull-ups go to 5 V. This is the common way to use it with an ESP32 and usually fine; the strictly safe option would be a level shifter, which the team decided not to add.','Backlight on but blank screen → turn the contrast trimmer on the back.','Pad every line to 16 characters so old text doesn’t stay behind.'],
  code:`#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);

void initLcd() { Wire.begin(21, 22); lcd.init(); lcd.backlight(); }

void show(const char* a, const char* b) {
  char l1[17], l2[17];
  snprintf(l1, 17, "%-16s", a); snprintf(l2, 17, "%-16s", b);
  lcd.setCursor(0, 0); lcd.print(l1);
  lcd.setCursor(0, 1); lcd.print(l2);
}` },
keypad:{ t:'Keypad 4×4', sum:'Drivers with a booking type their 4-digit PIN and #. Walk-ins press A.',
  kv:[['Rows R1–R4','GPIO17 · 16 · 4 · 0 (read with pull-ups)'],['Columns C1–C4','GPIO19 · 18 · 5 · 2 (scanned)'],['Keys','A walk-in · 0–9 PIN · # submit · * clear']],
  watch:['Physical pin order on most keypads is R1 R2 R3 R4 C1 C2 C3 C4, left to right — check yours with a test sketch.','GPIO2 drives the on-board LED on some boards; it may flicker while scanning — harmless.'],
  code:`#include <Keypad.h>
char keys[4][4] = {{'1','2','3','A'},{'4','5','6','B'},
                   {'7','8','9','C'},{'*','0','#','D'}};
byte rowPins[4] = {17, 16, 4, 0};
byte colPins[4] = {19, 18, 5, 2};
Keypad pad = Keypad(makeKeymap(keys), rowPins, colPins, 4, 4);
String pin;

void handleKeypad() {
  char k = pad.getKey();
  if (!k || lockedUntil > millis()) return;
  if (k == 'A') tryWalkIn();
  else if (k == '*') pin = "";
  else if (k == '#') { checkPin(pin); pin = ""; }
  else if (isDigit(k) && pin.length() < 4) pin += k;
}` },
light:{ t:'Garage light LED', sum:'The energy-saving light, switched by the PIR logic and forced on during an emergency.',
  kv:[['Anode','GPIO15 through 220 Ω'],['Cathode','GND rail'],['Limit','≤ 2 LEDs, each with its own resistor']],
  watch:['It may blink once at boot (GPIO15 is a strapping pin) — harmless.'],
  code:`pinMode(15, OUTPUT);  // driven by lighting()` },
psu:{ t:'5 V / 2 A power supply', sum:'A phone charger with a USB breakout is enough. It feeds everything that needs 5 V: both servos, MQ-2, HC-SR04, PIR, LCD, and the ESP32 through its 5V pin.',
  kv:[['5 V rail','servos ×2, MQ-2, HC-SR04, PIR, LCD, ESP32 5V'],['3V3 rail','from the ESP32 3V3 pin → IR ×5, buzzer'],['GND','one common ground for everything']],
  watch:['Supply GND must be tied to ESP32 GND.','While uploading code over USB, unplug the supply’s wire to the ESP32 5V pin unless you know the board has a protection diode.','Measure the rail with a multimeter before plugging in the ESP32: 4.9–5.2 V.'],
  code:'' },

/* logic */
boot:{ sum:'Runs once at power-up.', lcd:['PARKORA','Warming up  60s'], kv:[['Does','Connect Wi-Fi · both servos to 0° · fetch active bookings · MQ-2 warm-up and calibration']] },
idle:{ sum:'Default state. The LCD shows how many spaces a walk-in can use (free slots minus active bookings).', lcd:['PARKORA','Free 2 of 4'] },
detect:{ sum:'The ultrasonic distance drops under 8 cm when a car pulls up to the barrier.', kv:[['Yes','go to Prompt'],['No','stay Idle']] },
prompt:{ sum:'Asks the driver what to do.', lcd:['Welcome! Free:1','A=Walk-in PIN+#'] },
key:{ sum:'Reads the keypad without blocking.', kv:[['A','walk-in check'],['0–9 then #','PIN check'],['*','clear what was typed']] },
walk:{ sum:'A walk-in may only use a slot that is free and not booked. available = free slots − active bookings.', kv:[['> 0','open the gate and list the free, unbooked slots'],['= 0','Garage FULL']] },
fullMsg:{ sum:'Nobody gets in without a space.', lcd:['Garage FULL','Sorry, no space'], kv:[['Also','short beep · “full” event to dashboard']] },
verify:{ sum:'ESP32 computes SHA-256(PIN + ":" + booking id) and compares it with the hashes it pulled from the API. The plain PIN is never stored on the board or in the database.', kv:[['Match','booking matched'],['No match','count the attempt']] },
assign:{ sum:'Tells the driver which bay is theirs and marks the booking as arrived.', lcd:['Booking OK','Go to slot P2'] },
attempts:{ sum:'Protects against guessing.', lcd:['Wrong PIN (1/3)','Try again'] },
lockout:{ sum:'Three wrong PINs lock the keypad for 30 s.', lcd:['Locked 30s','Too many tries'], kv:[['Also','pin_fail event appears on the dashboard']] },
openEntry:{ sum:'Barrier up.', lcd:['Gate opening...','Drive in'] },
passed:{ sum:'The car has passed when the ultrasonic reads “clear” (> 12 cm) for 2 continuous seconds.' },
closeEntry:{ sum:'Barrier down; an entry event is sent (walk-in or booking).' },
slotUpd:{ sum:'When a bay sensor changes state (after 300 ms debounce) the LED follows in hardware and the new state is queued for the network task.', kv:[['Dashboard','updates in about 1 s through Supabase Realtime']] },
exitDet:{ sum:'Leaving needs no PIN.' },
openExit:{ sum:'Exit barrier up.' },
exitClear:{ sum:'IR clear for 2 s means the car has left.' },
closeExit:{ sum:'Barrier down, exit event logged.' },
pirDet:{ sum:'PIR output goes HIGH on movement.' },
lightOn:{ sum:'Light on and the 30 s timer restarts on every new movement.' },
lightTimer:{ sum:'Checks millis() against the last movement time.' },
lightOff:{ sum:'Light off — this is the energy saving.' },
gasRead:{ sum:'Non-blocking: only reads when 500 ms have passed.' },
gasDec:{ sum:'Three consecutive high readings filter out one-off noise.' },
emergency:{ sum:'Everything that matters for safety happens at once.', lcd:['!! GAS ALERT !!','EVACUATE NOW'], kv:[['Buzzer','1 Hz siren'],['Gates','exit open for evacuation · entry locked'],['Lights','forced on'],['Cloud','POST /api/device/alert → Telegram + dashboard banner']] },
gasClear:{ sum:'Back to normal after 10 s under the threshold. The alert stays on the dashboard until acknowledged.' },
net:{ sum:'Runs on the other CPU core so HTTP never blocks the gate or keypad. It sends the state whenever something changes and a heartbeat every 10 s; each reply carries the active bookings.', kv:[['Offline','the dashboard marks the garage offline after 30 s without a heartbeat'],['No Wi-Fi','walk-ins still work; PINs are checked against the last bookings received']] },

/* data */
sensors:{ sum:'Raw inputs read by the control loop.' },
fw:{ sum:'Holds the live state and the cached bookings. Sends JSON over HTTPS with a secret device key in the header.', kv:[['Libraries','WiFi, HTTPClient, ArduinoJson, ESP32Servo, LiquidCrystal_I2C, Keypad, mbedtls (SHA-256)'],['Auth','header x-device-key = DEVICE_KEY env var on Vercel']] },
apiSync:{ sum:'The main device endpoint. Saves the state, expires old bookings, and returns the active ones.', code:`// request
{ "slots": [1,0,0,1], "gas": 912, "light": true,
  "gates": { "entry": "closed", "exit": "closed" }, "rssi": -61 }

// response
{ "bookings": [
  { "id": "b7e1…", "slot": 2, "pin_hash": "9f2c…", "expires_in": 540 } ] }

// api/device/sync.js  (Vercel, Node.js)
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.headers["x-device-key"] !== process.env.DEVICE_KEY) return res.status(401).end();
  const s = req.body;
  await sb.from("device").upsert({ id: "parkora-01", last_seen: new Date(), gas: s.gas,
    light: s.light, entry_gate: s.gates.entry, exit_gate: s.gates.exit, rssi: s.rssi });
  await Promise.all(s.slots.map((occ, i) =>
    sb.from("slots").update({ occupied: !!occ }).eq("id", i + 1)));
  await sb.from("reservations").update({ status: "expired" })
    .eq("status", "active").lt("expires_at", new Date().toISOString());
  const { data } = await sb.from("reservations")
    .select("id, slot_id, pin_hash, expires_at").eq("status", "active");
  res.json({ bookings: data });
}` },
apiEvent:{ sum:'Logs what happened at the gates.', code:`{ "type": "entry_pin", "slot": 2, "meta": { "booking": "b7e1…" } }
// types: entry_walkin · entry_pin · pin_fail · lockout · exit · full` },
apiAlert:{ sum:'Saves the alert and sends a Telegram message to the staff group straight away.', code:`{ "type": "gas", "value": 1384 }

// inside the handler, after inserting into "alerts":
await fetch("https://api.telegram.org/bot" + process.env.TG_TOKEN + "/sendMessage", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ chat_id: process.env.TG_CHAT, text: "PARKORA: gas detected (" + value + ")" })
});` },
db:{ sum:'Five small tables. The dashboard reads with the public anon key under Row Level Security; only the API (service key) can write.', code:`create table slots (id int primary key, label text, occupied bool default false);
create table reservations (
  id uuid primary key default gen_random_uuid(),
  slot_id int references slots(id),
  driver_name text, plate text, phone text,
  pin_hash text not null,
  status text default 'active',  -- active · arrived · expired · cancelled
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create table events (id bigserial primary key, type text, slot_id int, meta jsonb, created_at timestamptz default now());
create table alerts (id bigserial primary key, type text, value int, status text default 'open', created_at timestamptz default now());
create table device (id text primary key, last_seen timestamptz, gas int, light bool, entry_gate text, exit_gate text, rssi int);` },
tg:{ sum:'Easiest real push notification for a demo: a bot posts to the team’s Telegram group. Token and chat id live in Vercel environment variables.' },
rt:{ sum:'The dashboard subscribes to slots, device, alerts and reservations. Every update arrives over a websocket in about a second — no polling.', code:`supabase.channel("garage")
  .on("postgres_changes", { event: "*", schema: "public", table: "slots" }, reload)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, showAlarm)
  .subscribe();` },
dash:{ sum:'A React app on Vercel (same project as the API). Pages: live garage map, book a slot, bookings list, events log, alerts.', kv:[['Live map','4 bays: free · booked · occupied'],['Book','pick a free bay → get a 4-digit PIN valid 15 min'],['Status','online/offline, gas level, gates, light']] },
driver:{ sum:'Opens the website on a phone before arriving and books a specific bay.' },
apiRes:{ sum:'Checks the bay is free and not booked, creates a random 4-digit PIN, stores only its hash, and shows the PIN to the driver once.', code:`import crypto from "crypto";

const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
const id = crypto.randomUUID();
const pin_hash = crypto.createHash("sha256").update(pin + ":" + id).digest("hex");
await sb.from("reservations").insert({ id, slot_id, driver_name, plate, phone, pin_hash,
  expires_at: new Date(Date.now() + 15 * 60 * 1000) });
res.json({ id, slot: slot_id, pin, expires_in: 900 });   // PIN shown once` }
};

/* ---------- pin map & tests ---------- */
const PIN_USE = {
  '3V3':['Power out → 3V3 rail (IR ×5, buzzer)','power'],'EN':['Reset button','avoid'],'36':['IR slot P1','used'],'39':['IR slot P2','used'],'34':['MQ-2 AO via divider (ADC1)','used'],'35':['HC-SR04 ECHO via divider','used'],'32':['IR slot P3','used'],'33':['IR slot P4','used'],'25':['Buzzer','used'],'26':['PIR OUT','used'],'27':['Exit IR','used'],'14':['Servo — exit','used'],'12':['Spare — keep LOW at boot','spare'],'GND':['Common ground','power'],'13':['Servo — entry','used'],'9':['SPI flash — don’t use','avoid'],'10':['SPI flash — don’t use','avoid'],'11':['SPI flash — don’t use','avoid'],'5V':['5 V in from the supply','power'],
  '23':['HC-SR04 TRIG','used'],'22':['I2C SCL — LCD','used'],'1':['USB serial TX — don’t use','avoid'],'3':['USB serial RX — don’t use','avoid'],'21':['I2C SDA — LCD','used'],'19':['Keypad C1','used'],'18':['Keypad C2','used'],'5':['Keypad C3','used'],'17':['Keypad R1 (not on WROVER)','used'],'16':['Keypad R2 (not on WROVER)','used'],'4':['Keypad R3','used'],'0':['Keypad R4 · shares BOOT button','used'],'2':['Keypad C4 · on-board LED','used'],'15':['Garage light LED','used'],'8':['SPI flash — don’t use','avoid'],'7':['SPI flash — don’t use','avoid'],'6':['SPI flash — don’t use','avoid']
};
const TESTS = [
  ['1','Power rails','Supply alone, multimeter on the rails','4.9–5.2 V on 5 V rail; nothing gets warm'],
  ['2','LCD','I2C scanner, then print “Hello PARKORA”','Address found (0x27/0x3F); text readable after contrast trim'],
  ['3','Keypad','Print every key to Serial','All 16 keys print the right character once per press'],
  ['4','HC-SR04','Print distance every 100 ms','Stable ±1 cm from 3–30 cm; < 8 cm prints CAR'],
  ['5','Servos','Sweep 0° → 90° → 0° on each','Smooth, ESP32 never resets, no buzzing at rest'],
  ['6','Slot IR ×4','Print the 4 states; place the car model','Each flips within 300 ms; its red LED follows'],
  ['7','Exit IR','Print state; block with the car','LOW when blocked, HIGH when clear'],
  ['8','PIR','Wait 60 s, wave a hand','HIGH on movement, LOW a few seconds later'],
  ['9','MQ-2','Warm up, log baseline, unlit lighter gas nearby','Reading clearly above baseline; threshold chosen'],
  ['10','Buzzer & light','Beep patterns, light on/off','Both respond; no reset when combined with servos'],
  ['11','Entry flow offline','Hard-coded test booking, no Wi-Fi','Reserved, walk-in, full and wrong-PIN scenarios pass'],
  ['12','Cloud link','Wi-Fi + /api/device/sync','Dashboard updates within ~2 s of a slot change'],
  ['13','Full system','All six scenarios on the finished model','Every step behaves as in the Logic tab']
];

/* ---------- helpers ---------- */
const VIEWS = [['model','3D build'],['wiring','Wiring'],['logic','Logic flow'],['data','Data flow'],['pins','Pin map'],['tests','Test plan']];
function bez(p1, c1, c2, p2) { return 'M' + p1.x + ',' + p1.y + ' C' + c1.x + ',' + c1.y + ' ' + c2.x + ',' + c2.y + ' ' + p2.x + ',' + p2.y; }
function bezMid(p1, c1, c2, p2) { const t = .5, u = .5; return { x: u*u*u*p1.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p2.x, y: u*u*u*p1.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p2.y }; }
const nodeW = n => n.w || FW;

function flowPath(a, b, hint, off) {
  off = off || 0;
  const aw = nodeW(a), bw = nodeW(b);
  const ac = { x: a.x + aw / 2, y: a.y + FH / 2 }, bc = { x: b.x + bw / 2, y: b.y + FH / 2 };
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  let p1, p2, c1, c2;
  if (hint === 'R' || hint === 'L') {                      // loop back on one side
    const r = hint === 'R', o = (50 + Math.min(60, Math.abs(dy) * .08)) * (r ? 1 : -1);
    p1 = { x: r ? a.x + aw : a.x, y: ac.y }; p2 = { x: r ? b.x + bw : b.x, y: bc.y };
    c1 = { x: p1.x + o, y: p1.y }; c2 = { x: p2.x + o, y: p2.y };
  } else if (hint === 'side') {                            // leave top/bottom, enter target from the side facing us
    const up = dy < 0, toLeft = dx < 0;
    p1 = { x: ac.x, y: up ? a.y : a.y + FH }; p2 = { x: toLeft ? b.x + bw : b.x, y: bc.y };
    c1 = { x: p1.x, y: p1.y + (up ? -1 : 1) * Math.max(60, Math.abs(p2.y - p1.y) * .6) };
    c2 = { x: p2.x + (toLeft ? 1 : -1) * Math.max(60, Math.abs(p2.x - p1.x) * .5), y: p2.y };
  } else if (Math.abs(dy) >= Math.abs(dx) * .55) {
    const down = dy > 0;
    p1 = { x: ac.x + off, y: down ? a.y + FH : a.y }; p2 = { x: bc.x + off, y: down ? b.y : b.y + FH };
    const k = Math.max(40, Math.abs(p2.y - p1.y) * .45) * (down ? 1 : -1);
    c1 = { x: p1.x, y: p1.y + k }; c2 = { x: p2.x, y: p2.y - k };
  } else {
    const right = dx > 0;
    p1 = { x: right ? a.x + aw : a.x, y: ac.y + off }; p2 = { x: right ? b.x : b.x + bw, y: bc.y + off };
    const k = Math.max(40, Math.abs(p2.x - p1.x) * .45) * (right ? 1 : -1);
    c1 = { x: p1.x + k, y: p1.y }; c2 = { x: p2.x - k, y: p2.y };
  }
  return { d: bez(p1, c1, c2, p2), mid: bezMid(p1, c1, c2, p2), end: p2 };
}

function initialPos(view) {
  const p = {};
  if (view === 'wiring') { p.esp = { x: ESP_X, y: ESP_Y }; COMPS.forEach(c => p[c.id] = { x: c.x, y: c.y }); p.psu = { x: PSU.x, y: PSU.y }; }
  else (view === 'logic' ? LOGIC : DATA).nodes.forEach(n => p[n.id] = { x: n.x, y: n.y });
  return p;
}

function bounds(view, pos) {
  let a = [];
  if (view === 'wiring') {
    a.push([pos.esp.x, pos.esp.y, ESP_W, ESP_HEAD + LEFT.length * ROW + 14]);
    COMPS.forEach(c => a.push([pos[c.id].x, pos[c.id].y, CW, compH(c)]));
    a.push([pos.psu.x, pos.psu.y, PSU.w, PSU.h]); a.push([-600, -60, 1, 1]); a.push([800, -60, 1, 1]);
  } else {
    const g = view === 'logic' ? LOGIC : DATA;
    g.nodes.forEach(n => a.push([pos[n.id].x, pos[n.id].y, nodeW(n), FH]));
    g.lanes.forEach(l => a.push([l.x, l.y, 200, 40]));
  }
  const x0 = Math.min(...a.map(r => r[0])), y0 = Math.min(...a.map(r => r[1]));
  const x1 = Math.max(...a.map(r => r[0] + r[2])), y1 = Math.max(...a.map(r => r[1] + r[3]));
  return { x0, y0, x1, y1 };
}

/* ---------- power rails (wiring view) ---------- */
function powerLines(pos) {
  const L5 = -530, L33 = -555, LG = -580, R5 = 760, RG = 785;
  const out = [], dots = [];
  const ext = { L5: [], L33: [], LG: [], R5: [], RG: [] };
  COMPS.forEach(c => {
    const p = pos[c.id], left = c.side === 'L';
    const ex = left ? p.x : p.x + CW;
    if (c.v === '5v' || c.v === '3v3') {
      const rail = left ? (c.v === '5v' ? L5 : L33) : R5;
      out.push({ pts: [[ex, p.y + 18], [rail, p.y + 18]], c: c.v === '5v' ? '#d7263d' : '#f08a24' });
      ext[left ? (c.v === '5v' ? 'L5' : 'L33') : 'R5'].push(p.y + 18); dots.push([rail, p.y + 18]);
    }
    if (c.v) {
      const g = left ? LG : RG;
      out.push({ pts: [[ex, p.y + 34], [g, p.y + 34]], c: 'var(--gnd)' });
      ext[left ? 'LG' : 'RG'].push(p.y + 34); dots.push([g, p.y + 34]);
    }
  });
  const ps = pos.psu, py5 = ps.y + 20, pyg = ps.y + 44;
  out.push({ pts: [[ps.x, py5], [L5, py5]], c: '#d7263d' }, { pts: [[ps.x + PSU.w, py5], [R5, py5]], c: '#d7263d' });
  out.push({ pts: [[ps.x, pyg], [LG, pyg]], c: 'var(--gnd)' }, { pts: [[ps.x + PSU.w, pyg], [RG, pyg]], c: 'var(--gnd)' });
  ext.L5.push(py5); ext.R5.push(py5); ext.LG.push(pyg); ext.RG.push(pyg);
  const e = pos.esp;
  const y33 = e.y + ESP_HEAD + 0 * ROW + ROW / 2, yG = e.y + ESP_HEAD + 13 * ROW + ROW / 2, yV = e.y + ESP_HEAD + 18 * ROW + ROW / 2;
  const topY = Math.min(e.y - 40, ...ext.L33) - 10;
  out.push({ pts: [[e.x, y33], [e.x - 24, y33], [e.x - 24, topY], [L33, topY]], c: '#f08a24', label: '3V3 out', lx: e.x - 140, ly: topY - 8 });
  ext.L33.push(topY);
  out.push({ pts: [[e.x, yV], [e.x - 40, yV], [e.x - 40, py5]], c: '#d7263d', label: '5V in', lx: e.x - 36, ly: yV - 8 });
  out.push({ pts: [[e.x, yG], [e.x - 58, yG], [e.x - 58, pyg]], c: 'var(--gnd)' });
  dots.push([e.x - 40, py5], [e.x - 58, pyg]);
  [['L5', L5, '#d7263d', '5V'], ['L33', L33, '#f08a24', '3V3'], ['LG', LG, 'var(--gnd)', 'GND'], ['R5', R5, '#d7263d', '5V'], ['RG', RG, 'var(--gnd)', 'GND']].forEach(([k, x, c, t]) => {
    const ys = ext[k]; if (!ys.length) return;
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    out.push({ pts: [[x, y0], [x, y1]], c, w: 3.5, label: t, lx: x - 9, ly: y0 - 10, rail: true });
  });
  return { out, dots };
}

/* ---------- graph canvas ---------- */
function Graph({ view, pos, setPos, sel, onSelect, showPower, hl, extra }) {
  const stage = useRef(null);
  const [t, setT] = useState({ x: 0, y: 0, k: .6 });
  const tRef = useRef(t); tRef.current = t;
  const drag = useRef(null);
  const posRef = useRef(pos); posRef.current = pos;

  const fit = useCallback(() => {
    const el = stage.current; if (!el) return;
    const b = bounds(view, posRef.current), W = el.clientWidth, H = el.clientHeight;
    const pad = 60, top = 56;
    const k = Math.min((W - pad * 2) / (b.x1 - b.x0), (H - pad - top - 50) / (b.y1 - b.y0), 1.1);
    setT({ k, x: (W - (b.x1 - b.x0) * k) / 2 - b.x0 * k, y: top + (H - top - 50 - (b.y1 - b.y0) * k) / 2 - b.y0 * k });
  }, [view]);
  useEffect(() => { fit(); }, [view]);
  useEffect(() => { const ro = new ResizeObserver(() => fit()); if (stage.current) ro.observe(stage.current); return () => ro.disconnect(); }, [fit]);

  useEffect(() => {
    const el = stage.current;
    const onWheel = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const cur = tRef.current, k = Math.min(2.5, Math.max(.2, cur.k * Math.exp(-e.deltaY * .0015)));
      setT({ k, x: mx - (mx - cur.x) * (k / cur.k), y: my - (my - cur.y) * (k / cur.k) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = f => { const el = stage.current, W = el.clientWidth / 2, H = el.clientHeight / 2; setT(c => { const k = Math.min(2.5, Math.max(.2, c.k * f)); return { k, x: W - (W - c.x) * (k / c.k), y: H - (H - c.y) * (k / c.k) }; }); };

  const onDown = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    const start = { px: e.clientX, py: e.clientY, moved: false, id, orig: id ? { ...pos[id] } : { x: tRef.current.x, y: tRef.current.y } };
    drag.current = start;
    if (!id) stage.current.classList.add('panning');
    const move = ev => {
      const d = drag.current; if (!d) return;
      const dx = ev.clientX - d.px, dy = ev.clientY - d.py;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (!d.moved) return;
      if (d.id) { const k = tRef.current.k; setPos(p => ({ ...p, [d.id]: { x: d.orig.x + dx / k, y: d.orig.y + dy / k } })); }
      else setT(c => ({ ...c, x: d.orig.x + dx, y: d.orig.y + dy }));
    };
    const up = () => {
      const d = drag.current; drag.current = null;
      stage.current && stage.current.classList.remove('panning');
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (d && !d.moved) onSelect(d.id || null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const keySel = id => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } };
  const cls = (id, base) => {
    let c = 'node ' + base;
    if (sel === id) c += ' sel';
    if (hl) { if (hl.cur === id) c += ' hl'; else if (!hl.nodes.has(id)) c += ' dim'; }
    else if (view === 'wiring' && sel && sel !== id && sel !== 'esp' && id !== 'esp') c += ' dim';
    return c;
  };

  let edges = [], nodes = [], labels = [], lanes = [];
  if (view === 'wiring') {
    if (showPower) {
      const { out, dots } = powerLines(pos);
      out.forEach((l, i) => {
        edges.push(h('polyline', { key: 'p' + i, points: l.pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: l.c, strokeWidth: l.w || 2, strokeDasharray: l.rail ? null : '5 4', strokeLinejoin: 'round', opacity: .9 }));
        if (l.label) labels.push(h('text', { key: 'pl' + i, x: l.lx, y: l.ly, className: 'elabel' }, l.label));
      });
      dots.forEach((d, i) => edges.push(h('circle', { key: 'd' + i, cx: d[0], cy: d[1], r: 3.5, fill: 'var(--ink)' })));
    }
    COMPS.forEach(c => {
      const p = pos[c.id];
      c.ports.forEach((pt, j) => {
        const right = c.side === 'R';
        const a = { x: p.x + (right ? 0 : CW), y: p.y + C_HEAD + j * PROW + PROW / 2 };
        const b = espPort(pt[1], pos);
        const dirA = right ? -1 : 1, span = Math.max(70, Math.abs(b.x - a.x) * .42);
        const on = sel === c.id || sel === 'esp';
        const d = bez(a, { x: a.x + dirA * span, y: a.y }, { x: b.x + b.dir * span, y: b.y }, b);
        edges.push(h('path', { key: c.id + j, d, fill: 'none', stroke: c.c, strokeWidth: on ? 3.2 : 2.2, opacity: sel && !on ? .25 : .95, className: sel === c.id ? 'flow-on' : null }));
        edges.push(h('circle', { key: c.id + j + 'a', cx: a.x, cy: a.y, r: 3.5, fill: c.c }));
      });
    });
    const e = pos.esp;
    nodes.push(h('div', { key: 'esp', className: cls('esp', 'esp'), style: { left: e.x, top: e.y, width: ESP_W }, tabIndex: 0, role: 'button', 'aria-label': 'ESP32 board', onPointerDown: ev => onDown(ev, 'esp'), onKeyDown: keySel('esp') },
      h('div', { className: 'eh' }, h('div', null, h('div', { className: 'nt' }, 'ESP32 DevKitC'), h('div', { className: 'ns' }, '38-pin · WROOM-32')), h('div', { className: 'shield' })),
      LEFT.map((l, i) => { const r = RIGHT[i]; return h('div', { className: 'prow', key: i },
        h('span', { className: 'pin ' + pinStatus(l) }, h('i', { className: 'pad' }), l[0]),
        h('span', { className: 'pin r ' + pinStatus(r) }, r[0], h('i', { className: 'pad' }))); }),
      h('div', { style: { height: 14 } })));
    COMPS.forEach(c => {
      const p = pos[c.id];
      nodes.push(h('div', { key: c.id, className: cls(c.id, ''), style: { left: p.x, top: p.y, width: CW }, tabIndex: 0, role: 'button', 'aria-label': c.t, onPointerDown: ev => onDown(ev, c.id), onKeyDown: keySel(c.id) },
        h('div', { className: 'nh' }, h('i', { className: 'sw', style: { background: c.c } }), h('div', null, h('div', { className: 'nt' }, c.t), h('div', { className: 'ns' }, c.s))),
        c.ports.map((pt, j) => h('div', { className: 'port', key: j, style: { flexDirection: c.side === 'R' ? 'row-reverse' : 'row' } }, h('span', null, pt[0]), h('b', { style: { color: c.c } }, 'GPIO' + pt[1])))));
    });
    if (showPower) {
      const ps = pos.psu;
      nodes.push(h('div', { key: 'psu', className: cls('psu', 'psu'), style: { left: ps.x, top: ps.y, width: PSU.w, height: PSU.h }, tabIndex: 0, role: 'button', 'aria-label': 'Power supply', onPointerDown: ev => onDown(ev, 'psu'), onKeyDown: keySel('psu') },
        h('div', { className: 'fn', style: { height: '100%' } }, h('div', { className: 'nt' }, '5 V / 2 A power supply'), h('div', { className: 'ns' }, '5V rail · GND rail · common ground'))));
    }
  } else {
    const g = view === 'logic' ? LOGIC : DATA;
    const byId = {}; g.nodes.forEach(n => byId[n.id] = { ...n, ...pos[n.id] });
    g.edges.forEach((ed, i) => {
      const a = byId[ed[0]], b = byId[ed[1]];
      const rev = g.edges.some(x => x[0] === ed[1] && x[1] === ed[0]);
      const f = flowPath(a, b, ed[3], rev ? (ed[0] < ed[1] ? -22 : 22) : 0);
      const on = hl ? hl.edges.has(ed[0] + '>' + ed[1]) : (sel && (sel === ed[0] || sel === ed[1]));
      const dimmed = (hl && !on) || (!hl && sel && !on);
      const col = on ? 'var(--acc)' : 'var(--mute)';
      edges.push(h('path', { key: 'e' + i, d: f.d, fill: 'none', stroke: col, strokeWidth: on ? 3 : 1.7, opacity: dimmed ? .3 : 1, markerEnd: on ? 'url(#arrOn)' : 'url(#arr)', className: on ? 'flow-on' : null }));
      if (ed[2]) labels.push(h('text', { key: 'l' + i, x: f.mid.x, y: f.mid.y + 4, textAnchor: 'middle', className: 'elabel' + (on ? ' on' : ''), opacity: dimmed ? .45 : 1 }, ed[2]));
    });
    g.lanes.forEach((l, i) => lanes.push(h('div', { key: 'ln' + i, className: 'lane', style: { left: l.x, top: l.y } }, l.t, h('small', null, l.s))));
    g.nodes.forEach(n => {
      const p = pos[n.id];
      const kindTxt = { dec: 'Decision', act: 'Action', alarm: 'Alert', start: view === 'logic' ? 'Start / task' : 'Core', ext: 'External' }[n.k];
      nodes.push(h('div', { key: n.id, className: cls(n.id, 'fn ' + n.k), style: { left: p.x, top: p.y, width: nodeW(n), height: FH }, tabIndex: 0, role: 'button', 'aria-label': n.t, onPointerDown: ev => onDown(ev, n.id), onKeyDown: keySel(n.id) },
        h('div', { className: 'kind' }, kindTxt), h('div', { className: 'nt' }, n.t), h('div', { className: 'ns' }, n.s)));
    });
  }

  const legend = view === 'wiring'
    ? [['#2f80ed', 'I2C'], ['#9b51e0', 'Keypad'], ['#13a8a8', 'Ultrasonic'], ['#e04f5f', 'Slot IR'], ['#f2994a', 'Servos'], ['#7aa52a', 'MQ-2']].concat(showPower ? [['#d7263d', '5 V'], ['#f08a24', '3.3 V'], ['var(--gnd)', 'GND']] : [])
    : [['var(--mute)', 'Flow'], ['var(--acc)', 'Active path']];

  return h('div', { className: 'stage', ref: stage, onPointerDown: e => onDown(e, null) },
    h('div', { className: 'world', style: { transform: 'translate(' + t.x + 'px,' + t.y + 'px) scale(' + t.k + ')' } },
      h('svg', { className: 'edges' },
        h('defs', null,
          h('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--mute)' })),
          h('marker', { id: 'arrOn', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, h('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--acc)' }))),
        edges, labels),
      lanes, nodes),
    h('div', { className: 'tools', onPointerDown: e => e.stopPropagation() },
      h('button', { className: 'tb', onClick: () => zoom(1.2), 'aria-label': 'Zoom in' }, '+'),
      h('button', { className: 'tb', onClick: () => zoom(1 / 1.2), 'aria-label': 'Zoom out' }, '−'),
      h('button', { className: 'tb', onClick: fit }, 'Fit'),
      h('button', { className: 'tb', onClick: () => { setPos(initialPos(view)); posRef.current = initialPos(view); fit(); } }, 'Reset layout'),
      extra),
    h('div', { className: 'legend', onPointerDown: e => e.stopPropagation() }, legend.map((l, i) => h('span', { key: i }, h('i', { style: { background: l[0] } }), l[1]))),
    h('div', { className: 'hint' }, 'Drag to move · scroll to zoom · click for details'));
}

/* ---------- side panel ---------- */
function Code({ text }) {
  const [ok, setOk] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }, () => {}); } catch (e) {} };
  return h('div', { className: 'codebox' }, h('button', { className: 'copy', onClick: copy }, ok ? 'Copied' : 'Copy'), h('pre', null, h('code', null, text)));
}
function Lcd({ lines }) { return h('div', { className: 'lcd', 'aria-label': 'LCD: ' + lines.join(' / ') }, lines.map((l, i) => h('div', { key: i }, (l + '                ').slice(0, 16)))); }

const INTRO = {
  wiring: { t: 'How everything is wired', p: 'Every part is drawn at its real pin on the 38-pin board — left column of the board on the left, right column on the right. Click a part to highlight its wires and see the voltage, the warnings and a test snippet. Turn on “Power rails” to see the 5 V, 3.3 V and GND wiring.',
    kv: [['Board', 'ESP32 DevKitC · 38-pin'], ['Pins used', '23 of 24 usable'], ['Extra parts', 'none — only resistors for the dividers and LEDs'], ['Slot LEDs', 'driven in hardware by the IR sensors']] },
  logic: { t: 'How the garage behaves', p: 'The entry flow runs as a state machine in the main loop; the exit lane, lighting and gas safety run beside it in the same loop without blocking each other. Pick a scenario above and step through it, or click any box.',
    kv: [['A', 'walk-in'], ['PIN + #', 'driver with a booking'], ['*', 'clear typed digits'], ['Booking', 'specific bay, PIN valid 15 min']] },
  data: { t: 'How data moves', p: 'The ESP32 never talks to the database directly. It calls three small Node.js functions on Vercel with a device key; they write to Supabase. The React dashboard (on the same Vercel project) gets changes live through Supabase Realtime and creates bookings through the API.',
    kv: [['Hosting', 'Vercel (React + Node.js /api)'], ['Database', 'Supabase Postgres + Realtime'], ['Alerts', 'Telegram bot + dashboard banner'], ['Security', 'device key header · RLS · PIN stored hashed']] }
};

function Panel({ view, sel, scen, step, setStep, playing, setPlaying }) {
  if (view === 'logic' && scen) {
    const s = SCENARIOS.find(x => x.id === scen);
    const cur = s.steps[step];
    const node = LOGIC.nodes.find(n => n.id === cur[0]);
    const d = D[cur[0]] || {};
    return h('div', null,
      h('h2', null, s.t), h('p', { className: 'muted lead' }, 'Step ' + (step + 1) + ' of ' + s.steps.length + ' · ' + node.t),
      h('p', null, cur[1]), d.lcd ? h(Lcd, { lines: d.lcd }) : null,
      h('div', { className: 'row' },
        h('button', { className: 'btn', onClick: () => setStep(Math.max(0, step - 1)), disabled: step === 0 }, 'Previous'),
        h('button', { className: 'btn pri', onClick: () => setPlaying(!playing) }, playing ? 'Pause' : 'Play'),
        h('button', { className: 'btn', onClick: () => setStep(Math.min(s.steps.length - 1, step + 1)), disabled: step === s.steps.length - 1 }, 'Next')),
      h('ol', { className: 'steps' }, s.steps.map((st, i) => h('li', { key: i, className: i === step ? 'cur' : '', onClick: () => setStep(i) }, LOGIC.nodes.find(n => n.id === st[0]).t))));
  }
  if (!sel) {
    const it = INTRO[view];
    return h('div', null, h('h2', null, it.t), h('p', { className: 'lead' }, it.p), h('h3', null, 'At a glance'),
      h('table', { className: 'kv' }, h('tbody', null, it.kv.map((r, i) => h('tr', { key: i }, h('td', null, r[0]), h('td', null, r[1]))))));
  }
  const d = D[sel] || {};
  const gNode = view !== 'wiring' ? (view === 'logic' ? LOGIC : DATA).nodes.find(n => n.id === sel) : null;
  const title = d.t || (gNode && gNode.t) || sel;
  const comp = COMPS.find(c => c.id === sel);
  return h('div', null,
    h('h2', null, title),
    gNode ? h('p', { className: 'muted lead' }, gNode.s) : comp ? h('p', { className: 'muted lead' }, comp.s) : null,
    d.sum ? h('p', null, d.sum) : null,
    d.lcd ? h('div', null, h('h3', null, 'LCD shows'), h(Lcd, { lines: d.lcd })) : null,
    d.kv ? h('div', null, h('h3', null, view === 'wiring' ? 'Connections' : 'Details'), h('table', { className: 'kv' }, h('tbody', null, d.kv.map((r, i) => h('tr', { key: i }, h('td', null, r[0]), h('td', { className: view === 'wiring' ? 'mono' : '' }, r[1])))))) : null,
    d.watch ? h('div', null, h('h3', null, 'Watch out'), h('ul', { className: 'watch' }, d.watch.map((w, i) => h('li', { key: i }, w)))) : null,
    d.code ? h('div', null, h('h3', null, view === 'data' ? 'Payload & code' : 'Code'), h(Code, { text: d.code })) : null);
}

/* ---------- doc views ---------- */
function PinMap() {
  const used = Object.values(PIN_USE).filter(v => v[1] === 'used').length;
  const table = (rows, side) => h('div', null, h('h3', null, side + ' column (top → bottom, USB at the bottom)'),
    h('table', { className: 't stack' }, h('thead', null, h('tr', null, h('th', null, 'Label'), h('th', null, 'GPIO'), h('th', null, 'Connected to'), h('th', null, 'Status'))),
      h('tbody', null, rows.map((r, i) => { const u = PIN_USE[r[1]] || ['', 'power']; return h('tr', { key: i },
        h('td', { className: 'g' }, r[0]), h('td', { className: 'g' }, /^\d+$/.test(r[1]) ? r[1] : '—'), h('td', null, u[0]), h('td', null, h('span', { className: 'tag ' + u[1] }, u[1]))); }))));
  return h('div', { className: 'doc' },
    h('h2', null, 'Pin map — ESP32 DevKitC, 38 pins'),
    h('p', { className: 'lead muted' }, 'Everything fits without extra chips: slot LEDs are driven by the IR sensors themselves, and the keypad uses the two pins the 38-pin board adds (GPIO0 and the second serial pair).'),
    h('div', { className: 'summary' },
      [[used, 'GPIO used'], ['1', 'spare (GPIO12)'], ['2', 'voltage dividers (1k/2k)'], ['5 V · 3.3 V', 'two rails, one GND']].map((s, i) => h('div', { className: 'stat', key: i }, h('b', null, s[0]), h('span', null, s[1])))),
    h('div', { className: 'cols' }, table(LEFT, 'Left'), table(RIGHT, 'Right')),
    h('h3', null, 'Resistors you need'),
    h('table', { className: 't stack' }, h('thead', null, h('tr', null, h('th', null, 'Where'), h('th', null, 'Values'), h('th', null, 'Why'))),
      h('tbody', null, [['HC-SR04 ECHO → GPIO35', '1 kΩ series + 2 kΩ to GND', '5 V echo → 3.3 V'], ['MQ-2 AO → GPIO34', '1 kΩ series + 2 kΩ to GND', 'analog up to 5 V → 3.3 V'], ['Slot LEDs ×4', '1 kΩ each, 3V3 → LED → sensor OUT', 'LED lights when the bay is occupied'], ['Garage light', '220 Ω', 'limit LED current to ~10 mA']].map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j }, c)))))));
}
function Tests() {
  return h('div', { className: 'doc' },
    h('h2', null, 'Test plan — one part at a time'),
    h('p', { className: 'lead muted' }, 'Test each part alone with a tiny sketch before combining. Only move to the next row when the “pass when” column is true. The code for every part is in the Wiring tab — click the part.'),
    h('div', { className: 'scroll', style: { marginTop: 18 } },
      h('table', { className: 't stack' }, h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Part'), h('th', null, 'What to run'), h('th', null, 'Pass when'))),
        h('tbody', null, TESTS.map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j, className: j === 0 ? 'g' : '' }, c))))))));
}

/* ---------- 3D tab ---------- */
function Model3D() {
  const ref = useRef(null);
  useEffect(() => {
    if (!window.Parkora3D) { ref.current.textContent = 'The 3D model could not load. Reload the page.'; return; }
    return window.Parkora3D.mount(ref.current);
  }, []);
  return h('div', { ref });
}

/* ---------- app ---------- */
function App() {
  const initialView = () => { const hsh = location.hash.slice(1); return VIEWS.some(v => v[0] === hsh) ? hsh : 'model'; };
  const [view, setView] = useState(initialView);
  const [posAll, setPosAll] = useState({ wiring: initialPos('wiring'), logic: initialPos('logic'), data: initialPos('data') });
  const [sel, setSel] = useState(null);
  const [showPower, setShowPower] = useState(false);
  const [scen, setScen] = useState('');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { const f = () => setView(initialView()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = v => { setView(v); setSel(null); setScen(''); setPlaying(false); if (location.hash.slice(1) !== v) location.hash = v; };

  useEffect(() => {
    if (!playing || !scen) return;
    const s = SCENARIOS.find(x => x.id === scen);
    const id = setInterval(() => setStep(st => { if (st >= s.steps.length - 1) { setPlaying(false); return st; } return st + 1; }), 1800);
    return () => clearInterval(id);
  }, [playing, scen]);

  const hl = useMemo(() => {
    if (view !== 'logic' || !scen) return null;
    const s = SCENARIOS.find(x => x.id === scen);
    const nodes = new Set(), edges = new Set();
    s.steps.slice(0, step + 1).forEach((st, i, arr) => { nodes.add(st[0]); if (i > 0) edges.add(arr[i - 1][0] + '>' + st[0]); });
    return { nodes, edges, cur: s.steps[step][0] };
  }, [view, scen, step]);

  const setPos = useCallback(fn => setPosAll(a => ({ ...a, [view]: typeof fn === 'function' ? fn(a[view]) : fn })), [view]);

  let extra = null;
  if (view === 'wiring') extra = h('button', { className: 'tb', 'aria-pressed': showPower, onClick: () => setShowPower(!showPower) }, 'Power rails');
  if (view === 'logic') extra = h('select', { className: 'tb', value: scen, 'aria-label': 'Scenario', onChange: e => { setScen(e.target.value); setStep(0); setSel(null); setPlaying(!!e.target.value); } },
    h('option', { value: '' }, 'Walk through a scenario…'), SCENARIOS.map(s => h('option', { key: s.id, value: s.id }, s.t)));

  const isGraph = view === 'wiring' || view === 'logic' || view === 'data';
  return h(React.Fragment, null,
    h('header', null,
      h('div', { className: 'top' }, h('h1', null, 'PARKORA'), h('span', { className: 'sub' }, 'Smart parking garage — 3D build, wiring, behaviour and data flow · ESP32 38-pin · React + Node.js + Supabase')),
      h('nav', { className: 'tabs', role: 'tablist' }, VIEWS.map(v => h('button', { key: v[0], className: 'tab', role: 'tab', 'aria-selected': view === v[0], onClick: () => go(v[0]) }, v[1])))),
    isGraph
      ? h('div', { className: 'main' },
          h(Graph, { key: view, view, pos: posAll[view], setPos, sel, onSelect: id => { setSel(id); if (id && scen) { setScen(''); setPlaying(false); } }, showPower, hl, extra }),
          h('aside', null, h(Panel, { view, sel, scen, step, setStep: s => { setStep(s); setPlaying(false); }, playing, setPlaying })))
      : view === 'model' ? h(Model3D) : view === 'pins' ? h(PinMap) : h(Tests));
}

ReactDOM.createRoot(rootEl).render(h(App));
}
}
