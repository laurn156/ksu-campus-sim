#include <Wire.h>
#include <math.h>

// Nest Life Mega 2560 controller. See docs/ELEGOO-WIRING.md before wiring.
const int joyX=A0, joyY=A1, lightPin=A2, joySwitch=2, button1=3, button2=4;
const int trigPin=6, echoPin=7, redLed=8, greenLed=9, buzzer=10;
unsigned long lastSample=0,lastCommand=0; int vending=0; String input="";
void setup(){
  Serial.begin(115200); Wire.begin(); Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
  pinMode(joySwitch,INPUT_PULLUP); pinMode(button1,INPUT_PULLUP); pinMode(button2,INPUT_PULLUP);
  pinMode(trigPin,OUTPUT); pinMode(echoPin,INPUT); pinMode(redLed,OUTPUT); pinMode(greenLed,OUTPUT); pinMode(buzzer,OUTPUT);
}
void loop(){
  while(Serial.available()) { char c=Serial.read(); if(c=='\n') { if(input.indexOf("\"broken\"")>=0) vending=1; else if(input.indexOf("\"fixed\"")>=0){if(vending!=2)tone(buzzer,880,150); vending=2;} else if(input.indexOf("\"idle\"")>=0) vending=0; lastCommand=millis(); input=""; } else if(input.length()<120) input+=c; else input=""; }
  if(millis()-lastCommand>2500) vending=0;
  digitalWrite(redLed,vending==1 && (millis()/400)%2); digitalWrite(greenLed,vending==2);
  if(millis()-lastSample<70)return; lastSample=millis();
  digitalWrite(trigPin,LOW); delayMicroseconds(2); digitalWrite(trigPin,HIGH); delayMicroseconds(10); digitalWrite(trigPin,LOW);
  unsigned long duration=pulseIn(echoPin,HIGH,12000); float cm=duration?duration*0.01715:-1;
  Wire.beginTransmission(0x68); Wire.write(0x3B); bool ok=Wire.endTransmission(false)==0 && Wire.requestFrom(0x68,6)==6;
  int16_t ax=0,ay=0,az=0; if(ok){ax=(Wire.read()<<8)|Wire.read();ay=(Wire.read()<<8)|Wire.read();az=(Wire.read()<<8)|Wire.read();}
  float tilt=ok?atan2((float)ay,(float)az)*180.0/PI:0;
  Serial.print("{\"v\":1,\"x\":");Serial.print(analogRead(joyX));Serial.print(",\"y\":");Serial.print(analogRead(joyY));
  Serial.print(",\"joy\":");Serial.print(digitalRead(joySwitch)==LOW?1:0);Serial.print(",\"b1\":");Serial.print(digitalRead(button1)==LOW?1:0);Serial.print(",\"b2\":");Serial.print(digitalRead(button2)==LOW?1:0);
  Serial.print(",\"cm\":");Serial.print(cm,1);Serial.print(",\"tilt\":");Serial.print(tilt,1);Serial.print(",\"gyro\":");Serial.print(ok?1:0);Serial.print(",\"light\":");Serial.print(analogRead(lightPin));Serial.println("}");
}
