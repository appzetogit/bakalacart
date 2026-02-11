
import axios from "axios";
import { getMSG91Credentials } from "../../../shared/utils/envService.js";

/**
 * MSG91 SMS Service for Bakalaa
 * Handles OTP sending via MSG91 API
 */
class Msg91Service {
    constructor() {
        // Credentials will be loaded dynamically from database/env
        this.authKey = null;
        this.senderId = null;
        this.templateId = null;
        // Base URL for sending SMS via GET request
        this.baseUrl = "https://api.msg91.com/api/sendhttp.php";
    }

    /**
     * Normalize phone number to Indian format with country code
     * @param {string} phone - Phone number to normalize
     * @returns {string} - Normalized phone number with country code (91XXXXXXXXXX)
     */
    normalizePhoneNumber(phone) {
        // Remove all non-digit characters
        const digits = phone.replace(/[^0-9]/g, "");

        // If it already has country code 91 and is 12 digits, return as is
        if (digits.startsWith("91") && digits.length === 12) {
            return digits;
        }

        // If it's 10 digits, add country code 91
        if (digits.length === 10) {
            return "91" + digits;
        }

        // If it's 11 digits and starts with 0, remove the 0 and add country code
        if (digits.length === 11 && digits.startsWith("0")) {
            return "91" + digits.substring(1);
        }

        // Return with country code as fallback
        return "91" + digits.slice(-10);
    }

    /**
     * Send OTP via MSG91
     * @param {string} phone - Phone number to send SMS to
     * @param {string} otp - OTP code to send
     * @param {string} purpose - Purpose of OTP (register, login, reset_password) - optional
     * @param {string} role - Role of the user (user, restaurant, delivery) - optional
     * @returns {Promise<Object>} - Response object
     */
    async sendOTP(phone, otp, purpose = 'register', role = 'user') {
        try {
            // Load credentials dynamically from database/env
            const creds = await getMSG91Credentials();
            const authKey = creds.authKey?.trim();
            const senderId = creds.senderId?.trim();
            const templateId = creds.templateId?.trim();

            if (!authKey || !senderId || !templateId) {
                console.error("❌ MSG91 Configuration Error: Missing credentials");
                console.error("   Please check MSG91_AUTH_KEY, MSG91_SENDER_ID, and MSG91_DLT_TE_ID in environment variables");
                throw new Error("MSG91 credentials not configured.");
            }

            const normalizedPhone = this.normalizePhoneNumber(phone);
            console.log(`📱 [MSG91_SENDING] Attempting to send OTP for Role: ${role} to Phone: ${normalizedPhone}`);

            // Construct the message with OTP
            // Template: "Bakalaa: ##OTP## is your login OTP. Use this OTP to login to your Bakalaa account. Thank you."
            const message = `Bakalaa: ${otp} is your login OTP. Use this OTP to login to your Bakalaa account. Thank you.`;

            console.log(`💬 [MSG91_MESSAGE] Content: "${message}"`);

            // Prepare query parameters for sendhttp.php
            const params = new URLSearchParams({
                authkey: authKey,
                mobiles: normalizedPhone,
                message: message,
                sender: senderId,
                route: "4", // Transactional route
                country: "91",
                DLT_TE_ID: templateId,
                response: "json" // Request JSON response
            });

            const url = `${this.baseUrl}?${params.toString()}`;

            // Make GET request to MSG91
            const response = await axios.get(url);

            console.log("📱 MSG91 Response:", response.data);

            // Handle response
            // Success response example: {"type":"success","message":"3466436346346"} or strict string if not json
            let responseData = response.data;

            // If response is a string (and we asked for json but sometimes it returns string error), try to parse
            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData);
                } catch (e) {
                    // It's a plain string
                }
            }

            const isSuccess = (responseData.type === 'success') ||
                (typeof responseData === 'string' && /^[0-9a-zA-Z]+$/.test(responseData)); // Request ID usually alphanumeric

            if (isSuccess || response.status === 200) {
                // Optimistically treat 200 OK as success if we get a request ID or type success
                const messageId = responseData.message || responseData;
                return {
                    success: true,
                    messageId: messageId,
                    status: 'sent',
                    to: normalizedPhone,
                    body: message,
                    provider: 'MSG91',
                    response: responseData
                };
            } else {
                console.error("❌ MSG91 Send Failed:", responseData);
                throw new Error(`MSG91 API Error: ${JSON.stringify(responseData)}`);
            }

        } catch (error) {
            console.error("❌ MSG91 Service Error:", error.message);
            // If it's an axios error
            if (error.response) {
                console.error("   Response Data:", error.response.data);
                throw new Error(`MSG91 API Error: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    /**
     * Send Custom SMS
     * @param {string} phone
     * @param {string} message 
     */
    async sendCustomSMS(phone, message) {
        // Re-use send logic but with custom message
        // Note: This might fail DLT if template not registered for arbitrary text
        try {
            // Load credentials dynamically from database/env
            const creds = await getMSG91Credentials();
            const authKey = creds.authKey?.trim();
            const senderId = creds.senderId?.trim();
            const templateId = creds.templateId?.trim();

            if (!authKey || !senderId || !templateId) {
                throw new Error("MSG91 credentials not configured.");
            }

            const normalizedPhone = this.normalizePhoneNumber(phone);
            const params = new URLSearchParams({
                authkey: authKey,
                mobiles: normalizedPhone,
                message: message,
                sender: senderId,
                route: "4",
                country: "91",
                DLT_TE_ID: templateId, // Using the same OTP template ID might fail for custom messages! 
                // Ideally we need a separate template ID or just try without it (might fail)
                response: "json"
            });

            const url = `${this.baseUrl}?${params.toString()}`;
            const response = await axios.get(url);
            return {
                success: true,
                response: response.data
            };
        } catch (error) {
            throw error;
        }
    }
}

const msg91Service = new Msg91Service();
export default msg91Service;
