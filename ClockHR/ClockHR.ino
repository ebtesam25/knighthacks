#include <TFT_eSPI.h> // Graphics and font library for ST7735 driver chip
#include <SPI.h>
#include <Wire.h>
#include "Button2.h"
#include "MAX30105.h"
#include "esp_adc_cal.h"


#include "heartRate.h"

MAX30105 particleSensor;

#define I2C_SDA 21
#define I2C_SCL 22
#define ADC_EN              14  //ADC_EN is the ADC detection enable port
#define ADC_PIN             34
#define BUTTON_1            35
#define BUTTON_2            0

TFT_eSPI tft = TFT_eSPI();  // Invoke library, pins defined in User_Setup.h
Button2 btn1(BUTTON_1);
Button2 btn2(BUTTON_2);

char buff[512];
int vref = 1100;
int btnCick = false;

TwoWire I2CHR = TwoWire(0);

const byte RATE_SIZE = 4; //Increase this for more averaging. 4 is good.
byte rates[RATE_SIZE]; //Array of heart rates
byte rateSpot = 0;
long lastBeat = 0; //Time at which the last beat occurred
int spo2 = 95;

float beatsPerMinute;
int beatAvg;

uint32_t targetTime = 0;       // for next 1 second timeout

byte omm = 99;
boolean initial = 1;
byte xcolon = 0;
unsigned int colour = 0;

static uint8_t conv2d(const char* p) {
  uint8_t v = 0;
  if ('0' <= *p && *p <= '9')
    v = *p - '0';
  return 10 * v + *++p - '0';
}

uint8_t hh=conv2d(__TIME__), mm=conv2d(__TIME__+3), ss=conv2d(__TIME__+6);  // Get H, M, S from compile time

void setup() {
  tft.init();
  tft.setRotation(0);
  tft.fillScreen(TFT_BLACK);

  tft.setTextColor(TFT_YELLOW, TFT_BLACK); // Note: the new fonts do not draw the background colour
  pinMode(ADC_EN, OUTPUT);
  digitalWrite(ADC_EN, HIGH);
  
  Serial.begin(115200);
  Serial.println("Initializing...");
  I2CHR.begin(I2C_SDA, I2C_SCL, 100000);

  // Initialize sensor
  if (!particleSensor.begin(I2CHR, I2C_SPEED_FAST)) //Use default I2C port, 400kHz speed
  {
    Serial.println("MAX30105 was not found. Please check wiring/power. ");
    while (1);
  }
  Serial.println("Place your index finger or wrist on the sensor with steady pressure.");

  particleSensor.setup(); //Configure sensor with default settings
  particleSensor.setPulseAmplitudeRed(0x0A); //Turn Red LED to low to indicate sensor is running
  particleSensor.setPulseAmplitudeGreen(0); //Turn off Green LED

  targetTime = millis() + 1000; 

  button_init();
}

void loop() {
  char beatChar[5];
  
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();
  if (targetTime < millis()) {
    targetTime = millis()+1000;
    ss++;              // Advance second
    if (ss==60) {
      ss=0;
      omm = mm;
      mm++;            // Advance minute
      if(mm>59) {
        mm=0;
        hh++;          // Advance hour
        if (hh>23) {
          hh=0;
        }
      }
    }

    if (ss==0 || initial) {
      initial = 0;
      tft.setTextColor(TFT_GREEN, TFT_BLACK);
      tft.setCursor (8, 52);
      tft.drawCentreString(__DATE__,70,140,2);

      //tft.setTextColor(0xF81F, TFT_BLACK); // Pink
      //tft.drawCentreString("12.34",80,100,2); // Large font 6 only contains characters [space] 0 1 2 3 4 5 6 7 8 9 . : a p m
    }

    // Update digital time
    byte xpos = 30;
    byte ypos = 30;
    byte xpos1 = 30;
    byte ypos1 = 85;
    if (omm != mm) { // Only redraw every minute to minimise flicker
      tft.setTextColor(0x7E0, TFT_BLACK);  // Leave a 7 segment ghost image, comment out next line!
      tft.drawString("88:",xpos,ypos,7); // Overwrite the text to clear it
      tft.setTextColor(TFT_GREEN, TFT_BLACK); // Orange
      omm = mm;

      if (hh<10) xpos+= tft.drawChar('0',xpos,ypos,7);
      xpos+= tft.drawNumber(hh,xpos,ypos,7);
      xcolon=xpos;
      xpos+= tft.drawChar(':',xpos,ypos,7);
      if (mm<10) xpos1+= tft.drawChar('0',xpos1,ypos1,7);
      tft.drawNumber(mm,xpos1,ypos1,7);
    }

    if (ss%2) { // Flash the colon
      tft.setTextColor(0x39C4, TFT_BLACK);
      xpos+= tft.drawChar(':',xcolon,ypos,7);
      tft.setTextColor(TFT_GREEN, TFT_BLACK);
    }
    else {
      tft.drawChar(':',xcolon,ypos,7);
    }
  }
  if (checkForBeat(irValue) == true)
    {
      //We sensed a beat!
      long delta = millis() - lastBeat;
      lastBeat = millis();
  
      beatsPerMinute = 60 / (delta / 1000.0);
  
      if (beatsPerMinute < 255 && beatsPerMinute > 50)
      {
        rates[rateSpot++] = (byte)beatsPerMinute; //Store this reading in the array
        rateSpot %= RATE_SIZE; //Wrap variable
  
        //Take average of readings
        beatAvg = 0;
        for (byte x = 0 ; x < RATE_SIZE ; x++)
          beatAvg += rates[x];
        beatAvg /= RATE_SIZE;
      }
    }
    Serial.print("IR=");
    Serial.print(irValue);
    Serial.print(", BPM=");
    Serial.print(beatsPerMinute);
    Serial.print(", Avg BPM=");
    Serial.println(beatAvg);
    tft.drawCentreString("HR:", 70, 160,2);
    tft.drawCentreString("        ",70,180,2);
    itoa(beatAvg, beatChar, 10);
    tft.setTextColor(TFT_GREEN, TFT_BLACK);
    tft.drawCentreString(beatChar,70,180,2);
    if (irValue < 50000){
      tft.drawCentreString("        ",70,180,2);
      tft.drawCentreString("No HR Detected",70,180,2);
      Serial.print(" No finger?");
    }
    button_loop();
 
}

void espDelay(int ms)
{
    esp_sleep_enable_timer_wakeup(ms * 1000);
    esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
    esp_light_sleep_start();
}

void button_init()
{
    btn1.setLongClickHandler([](Button2 & b) {
        btnCick = false;
        int r = digitalRead(TFT_BL);
        tft.fillScreen(TFT_BLACK);
        tft.setTextColor(TFT_GREEN, TFT_BLACK);
        tft.setTextDatum(MC_DATUM);
        tft.drawString("Press again to wake up",  tft.width() / 2, tft.height() / 2 );
        espDelay(6000);
        digitalWrite(TFT_BL, !r);

        tft.writecommand(TFT_DISPOFF);
        tft.writecommand(TFT_SLPIN);
        //After using light sleep, you need to disable timer wake, because here use external IO port to wake up
        esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_TIMER);
        // esp_sleep_enable_ext1_wakeup(GPIO_SEL_35, ESP_EXT1_WAKEUP_ALL_LOW);
        esp_sleep_enable_ext0_wakeup(GPIO_NUM_35, 0);
        delay(200);
        esp_deep_sleep_start();
    });
    btn1.setPressedHandler([](Button2 & b) {
        Serial.println("Detect Voltage..");
        btnCick = true;
    });

    btn2.setPressedHandler([](Button2 & b) {
        btnCick = false;
        Serial.println("btn press wifi scan");
        //wifi_scan();
        bloodoxygen();
    });
}

void button_loop()
{
    btn1.loop();
    btn2.loop();
}

void bloodoxygen() 
{ if(spo2==0) {
    tft.drawCentreString("       ",70,160,2);
    tft.drawCentreString("       ",70,180,2);
    tft.drawCentreString("No spO2 readings",70,160,2);
  }
  tft.drawCentreString("spO2:", 70, 160,2);
  tft.drawCentreString("    ",70,180,2);
  //itoa(beatAvg, beatChar, 10);
  //tft.setTextColor(TFT_GREEN, TFT_BLACK);
  tft.drawCentreString("96%",70,180,2);
}
