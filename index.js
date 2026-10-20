/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚫 COPYRIGHT & AUTHORSHIP WARNING 🚫
  Developer: @Dev_Null_X (Telegram)
  Brand: Node.js India Developers 🇮🇳
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const config = require("./config.js");
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const _0x_dev_null_identity = () => {
    const brand = "@Dev_Null_X";
    if (brand !== "@Dev_Null_X") { process.exit(1); }
    return brand;
};

app.get('/', (req, res) => res.send(`${_0x_dev_null_identity()} VC Bot is running safely! 🚀`));
app.listen(port, () => console.log(`[⚡] System active on port ${port}`));

const { apiId, apiHash, botToken, adminId, joinDelay } = config;

const sessionDir = "./sessions";
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

let clients = [];
let pendingLogins = {};

const adminFile = "./admins.json";
let adminList = [];
if (fs.existsSync(adminFile)) {
    adminList = JSON.parse(fs.readFileSync(adminFile));
} else {
    adminList = adminId.toString().split(',').map(id => id.trim());
    fs.writeFileSync(adminFile, JSON.stringify(adminList));
}

let lastLoginTime = 0; 
const LOGIN_COOLDOWN = 10 * 1000;

function extractChatIdentifier(url) {
    if (!url) return null;
    url = url.trim();
    if (!url.includes('t.me/')) return url.replace('@', '');
    if (url.includes('t.me/+') || url.includes('joinchat/')) return url.split('+').pop().split('/').pop();
    let cleanUrl = url.split('?')[0]; 
    return cleanUrl.split('t.me/').pop().split('/').pop(); 
}

async function loadAllSessions() {
    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.session'));
    for (const file of files) {
        try {
            const sessionStr = fs.readFileSync(path.join(sessionDir, file), 'utf8').trim();
            if (!sessionStr) continue;
            const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, { connectionRetries: 5 });
            await client.connect();
            clients.push(client);
        } catch (e) { console.log("Failed to load: " + file); }
    }
}

async function init() {
    console.log("SYSTEM BOOTING: " + _0x_dev_null_identity() + " VC MANAGER");
    await loadAllSessions();

    const botClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
    await botClient.start({ botAuthToken: botToken });
    console.log("Control Bot Online!");

    botClient.addEventHandler(async (event) => {
        const message = event.message;
        if (!message || !message.text) return;

        const senderId = message.senderId ? message.senderId.toString() : "unknown";
        if (!adminList.includes(senderId)) return message.reply({ message: "Access Denied!" });

        const args = message.text.split(" ");
        const command = args[0].toLowerCase();

        if (command === "/start") {
            await message.reply({ 
                message: "Welcome Boss!\n\n" +
                         "/login +91xxxx - Add Single Account (OTP)\n" +
                         "/seslog - Reply to .session or .zip file to auto-login\n" +
                         "/getsession - Get all sessions as .zip\n" +
                         "/joinvc [link] - Join All to VC\n" +
                         "/leavevc - Leave All VC\n" +
                         "/stats - Check Stats"
            });
        }

        else if (command === "/seslog") {
            if (!message.media || !message.media.document) {
                return message.reply({ message: "Reply to a .session or .zip file with /seslog" });
            }

            const fileName = message.media.document.attributes.find(a => a.className === 'DocumentAttributeFilename')?.fileName || "file";
            await message.reply({ message: "File process ho rahi hai..." });

            try {
                const buffer = await message.downloadMedia();
                const filesToLoad = [];

                if (fileName.endsWith('.session')) {
                    filesToLoad.push({ name: fileName, data: buffer.toString('utf8') });
                } else if (fileName.endsWith('.zip')) {
                    const zip = new AdmZip(buffer);
                    for (const entry of zip.getEntries()) {
                        if (entry.entryName.endsWith('.session')) {
                            filesToLoad.push({ name: entry.entryName, data: entry.getData().toString('utf8') });
                        }
                    }
                } else {
                    return message.reply({ message: "Sirf .session ya .zip file allowed hai." });
                }

                let loadedCount = 0;
                for (const file of filesToLoad) {
                    const tempClient = new TelegramClient(new StringSession(file.data.trim()), apiId, apiHash, { connectionRetries: 1 });
                    try {
                        await tempClient.connect();
                        const me = await tempClient.getMe();
                        const cleanPhone = me.phone ? me.phone.toString() : "Unknown";
                        const newFileName = "Account " + (clients.length + 1) + " [" + cleanPhone + "].session";
                        
                        fs.writeFileSync(path.join(sessionDir, newFileName), tempClient.session.save());
                        clients.push(tempClient);
                        loadedCount++;
                    } catch (e) {
                        console.log("Failed to load session: " + file.name);
                    }
                }
                await message.reply({ message: loadedCount + " sessions successfully load ho gaye!" });
            } catch (e) {
                await message.reply({ message: "Error: " + e.message });
            }
        }

        else if (command === "/login") {
            const phone = args[1];
            if (!phone) return message.reply({ message: "Usage: /login +91xxxxxxx" });
            if (pendingLogins[senderId]) return message.reply({ message: "Login already in progress." });

            await message.reply({ message: "Connecting..." });
            const tempClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 1 });
            pendingLogins[senderId] = { client: tempClient, phone: phone };

            tempClient.start({
                phoneNumber: phone,
                phoneCode: async () => {
                    await message.reply({ message: "OTP Sent. Reply: /otp 12345" });
                    pendingLogins[senderId].otpPromise = new Promise(resolve => pendingLogins[senderId].resolveOtp = resolve);
                    return await pendingLogins[senderId].otpPromise;
                },
                password: async () => {
                    await message.reply({ message: "2FA Detected. Reply: /pass password" });
                    pendingLogins[senderId].passPromise = new Promise(resolve => pendingLogins[senderId].resolvePass = resolve);
                    return await pendingLogins[senderId].passPromise;
                }
            }).then(async () => {
                await saveAccount(tempClient, phone, message);
            }).catch(async (err) => {
                await message.reply({ message: "Login Failed: " + err.message });
                delete pendingLogins[senderId];
            });
        }

        else if (command === "/otp") {
            const otp = args.slice(1).join("").replace(/[^0-9]/g, ''); 
            if (pendingLogins[senderId]?.resolveOtp) pendingLogins[senderId].resolveOtp(otp); 
        }

        else if (command === "/pass") {
            if (pendingLogins[senderId]?.resolvePass) pendingLogins[senderId].resolvePass(args[1]);
        }

        else if (command === "/getsession") {
            const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.session'));
            if (files.length === 0) return message.reply({ message: "Koi account nahi hai." });

            const zip = new AdmZip();
            for (const file of files) zip.addLocalFile(path.join(sessionDir, file));
            
            await botClient.sendFile(message.chatId, {
                file: zip.toBuffer(),
                caption: "All Sessions (" + files.length + ")\n\nIsko sambhal ke rakho!"
            });
        }
        
        else if (command === "/joinvc") {
            const rawLink = args[1];
            if (!rawLink) return message.reply({ message: "Usage: /joinvc link" });
            if (clients.length === 0) return message.reply({ message: "No accounts loaded." });
            
            await message.reply({ message: "Deploying " + clients.length + " accounts..." });
            const isPrivate = rawLink.includes('+') || rawLink.includes('joinchat/');
            const cleanLink = extractChatIdentifier(rawLink);

            for (let i = 0; i < clients.length; i++) {
                try {
                    let chatEntity;
                    if (isPrivate) {
                        try {
                            const result = await clients[i].invoke(new Api.messages.ImportChatInvite({ hash: cleanLink }));
                            chatEntity = result.chats[0];
                        } catch (e) {
                            if (e.errorMessage === 'USER_ALREADY_PARTICIPANT' || e.message.includes('USER_ALREADY_PARTICIPANT')) throw new Error("Already in group");
                            else throw e;
                        }
                    } else {
                        chatEntity = await clients[i].getEntity(cleanLink);
                    }

                    let callObject;
                    try {
                        const full = await clients[i].invoke(new Api.channels.GetFullChannel({ channel: chatEntity }));
                        callObject = full.fullChat.call;
                    } catch (e) {
                        const full = await clients[i].invoke(new Api.messages.GetFullChat({ chatId: chatEntity.id }));
                        callObject = full.fullChat.call;
                    }

                    if (!callObject) throw new Error("No active VC found.");

                    const joinParams = {
                        call: callObject,
                        joinAs: await clients[i].getMe(),
                        params: new Api.DataJSON({ data: JSON.stringify({ ssrc: Math.floor(Math.random() * 100000000) }) }),
                        muted: true
                    };

                    await clients[i].invoke(new Api.phone.JoinGroupCall(joinParams));
                    clients[i].currentCall = callObject;

                    if (clients[i].vcInterval) clearInterval(clients[i].vcInterval);
                    clients[i].vcInterval = setInterval(async () => {
                        try {
                            await clients[i].invoke(new Api.phone.JoinGroupCall(joinParams));
                        } catch (err) {
                            try {
                                await clients[i].invoke(new Api.phone.JoinGroupCall({
                                    call: callObject, joinAs: await clients[i].getMe(),
                                    params: new Api.DataJSON({ data: JSON.stringify({ ssrc: Math.floor(Math.random() * 100000000) }) }), muted: true
                                }));
                            } catch (e) {}
                        }
                    }, 10000);

                    await new Promise(r => setTimeout(r, joinDelay)); 
                } catch (e) { console.log("Acc Error: " + e.message); }
            }
            await message.reply({ message: "Process Completed!" });
        }
        
        else if (command === "/leavevc") {
            for (let i = 0; i < clients.length; i++) {
                try {
                    if (clients[i].vcInterval) { clearInterval(clients[i].vcInterval); clients[i].vcInterval = null; }
                    if (clients[i].currentCall) {
                        await clients[i].invoke(new Api.phone.LeaveGroupCall({ call: clients[i].currentCall, source: 0 }));
                        clients[i].currentCall = null;
                    }
                } catch (e) {}
            }
            await message.reply({ message: "All left VC." });
        }

        else if (command === "/stats") {
            const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.session'));
            await message.reply({ message: "Stats:\nTotal Sessions: " + files.length + "\nActive Clients: " + clients.length });
        }
        
    }, new NewMessage({ incoming: true }));
}

async function saveAccount(client, phone, message) {
    const sessionStr = client.session.save();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fileName = "Account " + (clients.length + 1) + " [" + cleanPhone + "].session";
    fs.writeFileSync(path.join(sessionDir, fileName), sessionStr);
    clients.push(client);
    lastLoginTime = Date.now();
    await message.reply({ message: "Account linked!\nFile: " + fileName });
    if (message.senderId) delete pendingLogins[message.senderId.toString()];
}

init().catch(console.error);
