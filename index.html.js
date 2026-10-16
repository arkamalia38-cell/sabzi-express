const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Sabzi / Items List
const ITEMS = {
    1: { name: 'Tomatoes', price: 80, unit: '1kg' },
    2: { name: 'Potatoes', price: 60, unit: '2kg' },
    3: { name: 'Coriander', price: 20, unit: '2 Bundles' }
};

// User Sessions Store
const userCarts = {};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!userCarts[from]) {
            userCarts[from] = { cart: [], step: 'WELCOME' };
        }

        const user = userCarts[from];

        // 1. Welcome Screen / Main Menu
        if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello' || user.step === 'WELCOME') {
            const welcomeMsg = `🌟 *WELCOME TO SABZI EXPRESS!* 🌟\n\n🎁 *GET 20% OFF YOUR FIRST ORDER!* (Use Code: *FRESH20*)\n\nAap kya khareedna chahte hain? Niche diye gaye number type karein:\n\n1️⃣ Tomatoes - ₹80 / 1kg\n2️⃣ Potatoes - ₹60 / 2kg\n3️⃣ Coriander - ₹20 / 2 Bundles\n\n*Commands:*\n- Type item number (1, 2, 3) to add\n- Type *BILL* to view total bill\n- Type *CHECKOUT* to place order`;
            
            await sock.sendMessage(from, { text: welcomeMsg });
            user.step = 'CHAT';
            return;
        }

        // 2. Interactive Chat - Add Items to Cart
        if (ITEMS[text]) {
            const selectedItem = ITEMS[text];
            user.cart.push(selectedItem);
            
            await sock.sendMessage(from, { 
                text: `✅ *${selectedItem.name}* (${selectedItem.unit}) cart me add ho gaya hai!\n\nAur add karne ke liye number bhejein, ya *BILL* type karein.` 
            });
            return;
        }

        // 3. Live Total Bill Screen
        if (text.toUpperCase() === 'BILL') {
            if (user.cart.length === 0) {
                await sock.sendMessage(from, { text: '🛒 Aapka cart abhi khaali hai!' });
                return;
            }

            let billText = `🧾 *LIVE TOTAL BILL*\n---------------------------\n`;
            let subtotal = 0;

            user.cart.forEach((item, index) => {
                billText += `${index + 1}. ${item.name} (${item.unit}) - ₹${item.price}\n`;
                subtotal += item.price;
            });

            billText += `---------------------------\n*Subtotal:* ₹${subtotal}\n*GRAND TOTAL:* ₹${subtotal}\n\nOrder confirm karne ke liye *CHECKOUT* type karein.`;

            await sock.sendMessage(from, { text: billText });
            return;
        }

        // 4. Checkout Screen
        if (text.toUpperCase() === 'CHECKOUT') {
            if (user.cart.length === 0) {
                await sock.sendMessage(from, { text: '🛒 Aapka cart khaali hai, checkout nahi ho sakta.' });
                return;
            }

            user.step = 'LOCATION';
            await sock.sendMessage(from, { 
                text: `📍 *CHECKOUT*\n\nKripya apna delivery location share karein (WhatsApp Location button se ya address type karke).\n\n*Payment Options:*\n💳 Online Payment (UPI / Card)\n💵 Cash on Delivery (COD)` 
            });
            return;
        }

        // Handle Location / Final Confirmation
        if (user.step === 'LOCATION') {
            await sock.sendMessage(from, { 
                text: `🎉 *Order Confirmed!*\n\nAapka order swikaar kar liya gaya hai. Sabzi jald hi aapke address par deliver ho jayegi.\n\nThank you for shopping with Sabzi Express!` 
            });
            // Reset Cart
            userCarts[from] = { cart: [], step: 'WELCOME' };
            return;
        }
    });
}

startBot();