/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification
 */

let razorpayLoaded = false;

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (razorpayLoaded) {
      resolve();
      return;
    }

    if (window.Razorpay) {
      razorpayLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Detect if running in APK/WebView context
 */
export const isMobileContext = () => {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return false;
    }

    const userAgent = navigator.userAgent || '';

    // Check for webview indicators
    const isWebView = /wv|WebView/i.test(userAgent);

    // Check for standalone mode (PWA)
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

    // Check for iOS standalone
    const isIOSStandalone = window.navigator.standalone === true;

    // Check for mobile device
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    // Check for Flutter bridge or Android bridge
    const hasNativeBridge = typeof window.flutter_inappwebview !== 'undefined' ||
      typeof window.Android !== 'undefined';

    return isWebView || isStandalone || isIOSStandalone || (isMobileDevice && hasNativeBridge) || (window.self !== window.top);
  } catch (error) {
    console.error('Error detecting mobile context:', error);
    return false;
  }
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Payment options
 * @param {String} options.key - Razorpay key ID
 * @param {String} options.amount - Amount in paise
 * @param {String} options.currency - Currency code
 * @param {String} options.order_id - Razorpay order ID
 * @param {String} options.name - Company/App name
 * @param {String} options.description - Payment description
 * @param {String} options.prefill.name - Customer name
 * @param {String} options.prefill.email - Customer email
 * @param {String} options.prefill.contact - Customer phone
 * @param {Object} options.notes - Additional notes
 * @param {Function} options.handler - Success callback
 * @param {Function} options.onError - Error callback
 * @param {Function} options.onClose - Close callback
 */
export const initRazorpayPayment = async (options) => {
  try {
    // Load Razorpay script if not already loaded
    await loadRazorpayScript();

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not available');
    }

    const isMobile = isMobileContext();
    const isInIframe = window.self !== window.top;

    const razorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency || 'INR',
      order_id: options.order_id,
      name: options.name || 'Bakalaa',
      description: options.description || 'Order Payment',
      image: options.image || '/bakalalogo.png',
      prefill: {
        name: options.prefill?.name || '',
        email: options.prefill?.email || '',
        contact: options.prefill?.contact || ''
      },
      notes: options.notes || {},
      theme: {
        color: '#E23744'
      },
      handler: function (response) {
        if (options.handler) {
          options.handler(response);
        }
      },
      modal: {
        ondismiss: function () {
          if (options.onClose) {
            options.onClose();
          }
        },
        // Ensure modal is clickable
        escape: true,
        animation: true
      },
      // Essential for WebView / Mobile App UPI intent
      webview_intent: true,
      // Enhanced configuration to show UPI icons (GPay, PhonePe, Paytm)
      // Matches the configuration from RentYatra project
      config: isMobile || isInIframe ? undefined : {
        display: {
          blocks: {
            upi: {
              name: "UPI",
              instruments: [
                {
                  method: "upi",
                  flows: ["qr", "intent"],
                },
              ],
            },
            banks: {
              name: "Other Payment Methods",
              instruments: [
                {
                  method: "upi",
                  flows: ["collect"],
                },
                {
                  method: "card",
                },
                {
                  method: "netbanking",
                },
                {
                  method: "wallet",
                },
              ],
            },
          },
          sequence: ["block.upi", "block.banks"],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      // Ensure proper retry logic
      retry: {
        enabled: true,
        max_count: 3
      }
    };

    const razorpay = new window.Razorpay(razorpayOptions);

    // Handle payment failures
    razorpay.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Payment failed. Please try again.' });
      }
    });

    // Handle payment method selection failures
    razorpay.on('payment.method_selection_failed', function (response) {
      console.error('Razorpay payment method selection failed:', response);
      if (options.onError) {
        options.onError(response.error || { description: 'Please select another payment method.' });
      }
    });

    // Open Razorpay modal
    razorpay.open();

    console.log('✅ Razorpay checkout opened successfully');
    console.log('Razorpay options:', {
      key: razorpayOptions.key ? 'Present' : 'Missing',
      amount: razorpayOptions.amount,
      order_id: razorpayOptions.order_id,
      isMobile,
      hasConfig: !!razorpayOptions.config
    });

    return razorpay;
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};


