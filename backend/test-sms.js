import axios from 'axios';

const testSMS = async () => {
    const apiKey = "1rUqwG84LECbjyFkfDNLCA";
    const senderId = "BAKCRT";
    const templateId = "1007318303408420217";
    const entityId = "1001989031247302937";
    const phone = "919993911855";
    const otp = "123456";

    // EXACT TEMPLATE FROM USER
    const message = `Bakalaa: ${otp} is your login OTP. Use this OTP to login to your Bakalaa account. Thank you.`;

    console.log(`🚀 Testing SMS to ${phone}`);
    console.log(`💬 Message: "${message}"`);

    const params = {
        APIKey: apiKey,
        msisdn: phone,
        sid: senderId,
        msg: message,
        fl: "0",
        dc: "0",
        gwid: "2",
        entityid: entityId,
        templateid: templateId
    };

    try {
        const response = await axios.get("http://cloud.smsindiahub.in/vendorsms/pushsms.aspx", { params });
        console.log("✅ API Response Status:", response.status);
        console.log("📄 API Response Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("❌ Request Failed:", error.message);
    }
};

testSMS();
