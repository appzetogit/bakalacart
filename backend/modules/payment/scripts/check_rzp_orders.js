
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

// Use absolute path
dotenv.config({ path: 'e:/bakalanew/bakalacart/backend/.env' });

const run = async () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id) {
        console.error("STILL NO KEYS even with absolute path.");
        process.exit(1);
    }

    const razorpay = new Razorpay({
        key_id,
        key_secret,
    });

    console.log("Checking Razorpay Orders for receipt: ORD-1771241035689-70");
    try {
        const orders = await razorpay.orders.all({ receipt: 'ORD-1771241035689-70' });
        console.log("Found RZP Orders count:", orders.items.length);

        if (orders.items.length === 0) {
            console.log("No order found with this receipt. Searching all recently paid payments...");
            const payments = await razorpay.payments.all({ count: 15 });
            payments.items.forEach(p => {
                console.log(`- ID: ${p.id}, Amount: ${p.amount / 100}, Status: ${p.status}, Order: ${p.order_id}, Phone: ${p.contact}, Receipt: ${p.notes?.receipt || 'N/A'}`);
            });
        } else {
            console.log("RZP Order 1 ID:", orders.items[0].id);
            const payments = await razorpay.orders.fetchPayments(orders.items[0].id);
            console.log("Payments for this RZP order:", JSON.stringify(payments, null, 2));
        }
    } catch (e) {
        console.error("API Call failed:", e);
    }
    process.exit(0);
};

run();
