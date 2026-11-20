// Joystick and light sensor test for Nest Life's controller protocol.
// Joystick: VRx=A0, VRy=A1, SW=D2, VCC=5V, GND=GND.
// Photoresistor voltage divider output: A2.
const int joystickX = A0;
const int joystickY = A1;
const int joystickButton = 2;
const int lightSensor = A2;
void setup() {
  Serial.begin(115200);
  pinMode(joystickButton, INPUT_PULLUP);
}
void loop() {
  Serial.print(F("{\"v\":1,\"x\":")); Serial.print(analogRead(joystickX));
  Serial.print(F(",\"y\":")); Serial.print(analogRead(joystickY));
  Serial.print(F(",\"joy\":")); Serial.print(digitalRead(joystickButton)==LOW ? 1 : 0);
  Serial.print(F(",\"b1\":0,\"b2\":0,\"cm\":-1,\"tilt\":0,\"gyro\":0,\"light\":"));
  Serial.print(analogRead(lightSensor));
  Serial.println(F("}"));
  while (Serial.available()) Serial.read();
  delay(70);
}
