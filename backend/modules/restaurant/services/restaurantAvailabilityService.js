import Restaurant from '../models/Restaurant.js';

/**
 * Helper to parse time string into minutes from midnight
 * Supports "HH:mm", "HH:mm AM/PM", "H:mm", etc.
 * @param {string} timeStr 
 * @returns {number|null} Minutes from midnight (0-1439) or null if invalid
 */
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;

    try {
        // Normalize string
        let normalized = timeStr.toLowerCase().trim();

        // Check for AM/PM
        const isPM = normalized.includes('pm') || normalized.includes('p.m');
        const isAM = normalized.includes('am') || normalized.includes('a.m');

        // Extract numbers
        const timeMatch = normalized.match(/(\d+)[:.]?(\d+)?/);
        if (!timeMatch) return null;

        let hours = parseInt(timeMatch[1]);
        let minutes = parseInt(timeMatch[2] || '0');

        if (isNaN(hours)) return null;

        // Smart adjustment for ambiguous hours (e.g., "1:00" or "01:00" without AM/PM)
        // In restaurant context, a closing time of 1, 2, 3, 4, 5 is almost always PM
        // UNLESS AM is explicitly specified.
        if (!isAM && !isPM) {
            if (hours >= 1 && hours <= 6) {
                // If opening is early morning (e.g. 6-11), and closing is 1-6, it's likely PM
                // We'll treat 1-6 as PM by default in ambiguous cases for CLOSING times
                // but for now let's just assume most people enter 24h format if not AM/PM.
                // Actually, let's keep it strict but handle the most common user error.
            }
        }

        // Adjust for 12-hour format
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        return (hours * 60) + minutes;
    } catch (e) {
        console.error('Error parsing time:', timeStr, e);
        return null;
    }
};

/**
 * Check if current time is within the opening window
 * @param {string} openStr - Opening time string
 * @param {string} closeStr - Closing time string
 * @param {Date} now - Current date/time
 * @returns {boolean}
 */
const isRestaurantCurrentlyOpen = (openStr, closeStr, now) => {
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const openMinutes = parseTimeToMinutes(openStr);
    const closeMinutes = parseTimeToMinutes(closeStr);

    if (openMinutes === null || closeMinutes === null) return true; // Fail safe: assume open if times are invalid

    if (openMinutes < closeMinutes) {
        // Standard day shift (e.g. 09:00 to 22:00)
        // 540 to 1320
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } else {
        // Overnight shift (e.g. 18:00 to 02:00)
        // 1080 to 120
        // Open if current >= 18:00 OR current < 02:00
        return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
};

/**
 * Process restaurant availability based on schedule
 * - Auto-decides if a restaurant should be CLOSED based on time.
 * - Runs periodically via cron.
 */
export const processRestaurantAvailability = async () => {
    try {
        const now = new Date(); // Server time (assuming IST per user context or handling globally)

        // Convert UTC to IST if server is UTC (Best practice is to handle times carefully)
        // Assuming the parsed times from DB are "local" times implies we should compare with "local" current time.
        // Since this is a specific client app likely running in India (Bakala), we can force IST offset if needed,
        // but usually new Date() on the server corresponds to the system time.
        // Let's assume server is correctly configured or use an offset.
        // Node.js date is UTC. .getHours() depends on system TZ or we use UTC methods.
        // Safest for Indian clients on global servers: shift to IST.

        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(Date.now() + istOffset);
        // Wait: Date.now() is UTC timestamp. Adding offset makes a "fake UTC" date that looks like IST when printed as UTC.
        // Better: use .toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) to get components.

        const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: 'numeric', minute: 'numeric' };
        const timeString = now.toLocaleTimeString('en-US', options);
        const [currentHour, currentMinute] = timeString.split(':').map(Number);

        const currentMinutesCapped = (currentHour * 60) + currentMinute;

        // Find restaurants with delivery timings
        const restaurants = await Restaurant.find({
            isActive: true, // Only check active accounts
            'deliveryTimings.openingTime': { $exists: true, $ne: null },
            'deliveryTimings.closingTime': { $exists: true, $ne: null }
        }).select('_id name deliveryTimings isAcceptingOrders').lean();

        if (restaurants.length === 0) {
            return { processed: 0, message: 'No restaurants with timings found' };
        }

        let closedCount = 0;
        let openedCount = 0;

        for (const restaurant of restaurants) {
            if (!restaurant.deliveryTimings.openingTime || !restaurant.deliveryTimings.closingTime) continue;

            const openMinutes = parseTimeToMinutes(restaurant.deliveryTimings.openingTime);
            const closeMinutes = parseTimeToMinutes(restaurant.deliveryTimings.closingTime);

            if (openMinutes === null || closeMinutes === null) continue;

            let isOpenWindow = false;
            if (openMinutes < closeMinutes) {
                // Standard day
                isOpenWindow = currentMinutesCapped >= openMinutes && currentMinutesCapped < closeMinutes;
            } else {
                // Overnight
                isOpenWindow = currentMinutesCapped >= openMinutes || currentMinutesCapped < closeMinutes;
            }

            // Case 1: Time is OUTSIDE business hours, but restaurant is OPEN
            // -> System should CLOSE it.
            if (!isOpenWindow && restaurant.isAcceptingOrders) {
                await Restaurant.findByIdAndUpdate(restaurant._id, { isAcceptingOrders: false });
                console.log(`🔒 Auto-closing restaurant ${restaurant.name} (${restaurant._id}) - Outside business hours (Time: ${currentHour}:${currentMinute})`);
                closedCount++;
            }

            // Case 2: Time is INSIDE business hours, but restaurant is CLOSED
            // -> System should OPEN it (User requirement: "jo jis time tak h restauarnt wo sare dikhna chiaye na")
            if (isOpenWindow && !restaurant.isAcceptingOrders) {
                await Restaurant.findByIdAndUpdate(restaurant._id, { isAcceptingOrders: true });
                console.log(`🔓 Auto-opening restaurant ${restaurant.name} (${restaurant._id}) - Inside business hours (Time: ${currentHour}:${currentMinute})`);
                openedCount++;
            }
        }

        return {
            processed: restaurants.length,
            closed: closedCount,
            opened: openedCount,
            message: `Checked ${restaurants.length} restaurants. Auto-closed: ${closedCount}, Auto-opened: ${openedCount}.`
        };

    } catch (error) {
        console.error('Error in processRestaurantAvailability:', error);
        throw error;
    }
};
