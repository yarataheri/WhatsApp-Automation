import { create } from '@wppconnect-team/wppconnect';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const NUMBERS_FILE = './whatsapp_numbers.json';
const TEXT_FILE = path.join(process.cwd(), 'messages', 'first.txt');

let hasRun = false;

/* -------------------- SERVER -------------------- */

app.get('/', (req, res) => {
  res.send('📨 WhatsApp Safe Sender is running');
});

app.listen(3000, () => {
  console.log('🚀 Server running at http://localhost:3000');
});

/* -------------------- WHATSAPP INIT -------------------- */

create({
  session: 'my-session',
  autoClose: 0,
  headless: false,
  useChrome: true,
  catchQR: (base64Qrimg, asciiQR) => {
    console.log('📸 Scan QR Code:\n');
    console.log(asciiQR);
  },
  statusFind: (statusSession, session) => {
    console.log(`🟢 Session [${session}] status: ${statusSession}`);
  },
  puppeteerOptions: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
})
  .then(client => {

    client.onStateChange(async (state) => {
      console.log('🔄 WhatsApp state:', state);

      if (
        (state === 'CONNECTED' || state === 'inChat' || state === 'isLogged') &&
        !hasRun
      ) {
        hasRun = true;
        console.log('✅ WhatsApp ready → waiting before sending');
        await delay(20000); // anti-ban warm-up
        await runMessageFlow(client);
      }

      if (state === 'CONFLICT') {
        console.log('⚠️ Conflict detected → using this session');
        await client.useHere();
      }

      if (state === 'UNPAIRED') {
        console.log('🔐 Session unpaired → QR scan required again');
        hasRun = false;
      }
    });

  })
  .catch(err => {
    console.error('❌ WhatsApp init failed:', err);
  });

/* -------------------- MAIN FLOW -------------------- */

async function runMessageFlow(client) {
  console.log('🚀 runMessageFlow() started');

  let successCount = 0; // ✅ SUCCESS COUNTER

  try {
    if (!fs.existsSync(NUMBERS_FILE)) {
      console.error(`❌ numbers.json not found`);
      return;
    }

    if (!fs.existsSync(TEXT_FILE)) {
      console.error(`❌ first.txt not found`);
      return;
    }

    const numbers = JSON.parse(fs.readFileSync(NUMBERS_FILE, 'utf-8'));
    if (!numbers.length) {
      console.warn('⚠️ No numbers found');
      return;
    }

    const textMessage = fs.readFileSync(TEXT_FILE, 'utf-8').trim();
    if (!textMessage) {
      console.warn('⚠️ Message text is empty');
      return;
    }

    for (const number of numbers) {
      const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

      try {
        console.log(`📞 Checking WhatsApp: ${chatId}`);

        const status = await client.checkNumberStatus(chatId);
        if (!status?.canReceiveMessage) {
          console.log(`❌ Not on WhatsApp → skipped`);
          continue;
        }

        console.log(`📤 Sending text to ${chatId}`);
        await client.sendText(chatId, textMessage);

        successCount++; // ✅ COUNT SUCCESS
        console.log(`✅ Sent successfully`);

        await delay(30000); // anti-ban delay per number

      } catch (err) {
        const msg = err.message?.toLowerCase() || '';

        if (
          msg.includes('no lid for user') ||
          msg.includes('invalid wid')
        ) {
          console.log(`⚠️ WhatsApp rejected number → skipped`);
          continue;
        }

        console.error(`❌ Unexpected error:`, err.message);
      }
    }

    console.log('🎉 All messages processed safely');
    console.log(`📊 Successfully sent: ${successCount} / ${numbers.length}`);

  } catch (err) {
    console.error('❌ Fatal error:', err);
  }
}

/* -------------------- HELPERS -------------------- */

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
