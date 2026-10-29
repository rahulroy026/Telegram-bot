const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, collection } = require('firebase/firestore');

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCrfLgKKaXUb-HBvt0wyT4DOGpVa6LaJzQ",
  authDomain: "auto-join-bot-telegram.firebaseapp.com",
  projectId: "auto-join-bot-telegram",
  storageBucket: "auto-join-bot-telegram.firebasestorage.app",
  messagingSenderId: "1021469404118",
  appId: "1:1021469404118:web:3880252900f70f5fce9277"
};

// Firebase aur Database (Firestore) Start karna
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. TELEGRAM BOT CONFIGURATION ---
const token = '9136743071:AAFThKbADIhOmJZwPZgTDs-F9kHmI9H8nz4';
const bot = new TelegramBot(token, { polling: true });

// --- 3. SECRET PASSWORD SETTINGS ---
// Is password ko aap jab chahein change kar sakte hain
const SECRET_PASSWORD = 'MySecretAdmin123'; 

// --- 4. EXPRESS SERVER (Render.com ke liye zaruri) ---
const webApp = express();
const port = process.env.PORT || 3000;
webApp.get('/', (req, res) => res.send('Bot is running perfectly!'));
webApp.listen(port, () => console.log(`Server listening on port ${port}`));

// --- FEATURE A: NAYE USERS KO AUTO-APPROVE AUR SAVE KARNA ---
bot.on('chat_join_request', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userFirstName = msg.from.first_name || '';
    const username = msg.from.username || 'No_Username';

    try {
        // 1. User ki request approve karna
        await bot.approveChatJoinRequest(chatId, userId);
        console.log(`Approved new user: ${userFirstName}`);

        // 2. Data Firebase me save karna
        await setDoc(doc(db, "users", userId.toString()), {
            userId: userId,
            firstName: userFirstName,
            username: username,
            joinedAt: new Date().toISOString(),
            source: "auto_approve"
        }, { merge: true });
        
        // 3. Private message bhejna
        bot.sendMessage(userId, `Hello ${userFirstName}, welcome to the channel! Aapki request approve ho gayi hai.`);

    } catch (error) {
        console.error("Error approving/saving user:", error);
    }
});

// --- FEATURE B: PURANE USERS KO SAVE KARNA (/start COMMAND SE) ---
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const userFirstName = msg.from.first_name || '';
    const username = msg.from.username || 'No_Username';
    const chatId = msg.chat.id;

    // Check karna ki msg Private Chat me aaya hai (Channel me nahi)
    if (msg.chat.type === 'private') {
        try {
            await setDoc(doc(db, "users", userId.toString()), {
                userId: userId,
                firstName: userFirstName,
                username: username,
                joinedAt: new Date().toISOString(),
                status: "verified",
                source: "start_command"
            }, { merge: true });

            bot.sendMessage(chatId, `Hello ${userFirstName}! Aapki profile successfully register ho gayi hai. Ab aapko important updates yahan milenge.`);
        } catch (error) {
            console.error("Error saving existing user:", error);
            bot.sendMessage(chatId, "Kuch technical error aaya, kripya thodi der baad try karein.");
        }
    }
});

// --- FEATURE C: SABKO MESSAGE BROADCAST KARNA ---
// Command format: /broadcast MySecretAdmin123 Hello everyone!
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim(); 

    // 1. Password Check karna
    if (!input.startsWith(SECRET_PASSWORD)) {
        return bot.sendMessage(chatId, "⚠️ Unauthorized! Wrong password.");
    }

    // 2. Password ko hatakar sirf message nikalna
    const textToSend = input.replace(SECRET_PASSWORD, '').trim();

    if (!textToSend) {
        return bot.sendMessage(chatId, "⚠️ Password sahi hai, par aapne koi message nahi likha.");
    }

    bot.sendMessage(chatId, "✅ Password accepted! Broadcast started... Please wait.");

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        let successCount = 0;
        let failCount = 0;

        // 3. Har saved user ko msg bhejna
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            try {
                await bot.sendMessage(userData.userId, textToSend);
                successCount++;
            } catch (err) {
                failCount++;
                console.log(`Failed to send to ${userData.userId}`);
            }
            // Telegram block na kare isliye har message ke beech thoda time (50ms) ka gap rakha hai
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        bot.sendMessage(chatId, `🎉 Broadcast finished!\n✅ Sent successfully: ${successCount}\n❌ Failed (Blocked bot/Deleted acc): ${failCount}`);
    } catch (error) {
        console.error("Broadcast Error:", error);
        bot.sendMessage(chatId, "❌ Failed to broadcast message. System error.");
    }
});

console.log('Bot is starting...');
