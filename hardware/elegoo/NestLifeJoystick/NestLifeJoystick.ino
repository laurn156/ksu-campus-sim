// Joystick-only test for Nest Life's controller protocol.
// Joystick: VRx=A0, VRy=A1, SW=D2, VCC=5V, GND=GND.
const int joystickX = A0;
const int joystickY = A1;
const int joystickButton = 2;
void setup() {
  Serial.begin(115200);
  pinMode(joystickButton, INPUT_PULLUP);
}
void loop() {
  Serial.print(F("{\"v\":1,\"x\":")); Serial.print(analogRead(joystickX));
  Serial.print(F(",\"y\":")); Serial.print(analogRead(joystickY));
  Serial.print(F(",\"joy\":")); Serial.print(digitalRead(joystickButton)==LOW ? 1 : 0);
  Serial.println(F(",\"b1\":0,\"b2\":0,\"cm\":-1,\"tilt\":0,\"gyro\":0,\"light\":512}"));
  while (Serial.available()) Serial.read();
  delay(70);
}
