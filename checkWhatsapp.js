// checkWhatsapp.js
import { create } from '@wppconnect-team/wppconnect';
import fs from 'fs';

const INPUT_FILE = './numbers.json';  // Valid mobile numbers from filterNumbers.js
const OUTPUT_FILE = './whatsapp_numbers.json';  // This will store valid WhatsApp numbers

create({ session: 'check-session', autoClose: 0, headless: true })
.then(async client => {
  const numbers = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const finalList = [];

  for (const number of numbers) {
    const chatId = `${number}@c.us`;  // Format for WhatsApp contact

    try {
      const status = await client.checkNumberStatus(chatId);

      if (status?.canReceiveMessage) {
        console.log(`✅ On WhatsApp: ${number}`);
        finalList.push(number);
      } else {
        console.log(`❌ Not on WhatsApp: ${number}`);
      }

      await delay(5000);  // 5 seconds delay between checks
    } catch (err) {
      console.log(`⚠️ Error checking ${number}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalList, null, 2));
  console.log(`🎯 Final WhatsApp list saved: ${finalList.length}`);
});

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
