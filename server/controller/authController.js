const { User } = require('../model/index');
const crypto = require('crypto');

// --- Helper for Display Name Generation ---
const adjectives = ["Quick", "Bright", "Silent", "Happy", "Lucky", "Clever", "Brave", "Calm", "Eager", "Gentle", "Swift", "Wise", "Bold", "Keen", "Vivid"];
const nouns = ["Fox", "Tiger", "Panda", "Eagle", "Wolf", "Lion", "Bear", "Shark", "Hawk", "Jaguar", "Sparrow", "Robin", "Falcon", "Owl", "Badger"];

// Basic generator, collisions possible but less likely with number
async function generateUniqueDisplayName() {
    let displayName = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (!isUnique && attempts < maxAttempts) {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 900) + 100; // 100-999
        displayName = `${adj}${noun}${num}`;

        // Check if displayName already exists (optional but recommended)
        const existingUser = await User.findOne({ displayName: displayName }).lean();
        if (!existingUser) {
            isUnique = true;
        }
        attempts++;
    }
    if (!isUnique) {
        // Fallback if unique name not found after attempts (e.g., use email prefix or timestamp)
        console.warn("Could not generate unique display name, using fallback.");
        displayName = `User${Date.now().toString().slice(-6)}`;
    }
    return displayName;
}

// Helper to generate avatar URL
function generateAvatarUrl(seed) {
    // Using a public placeholder service. Replace with your preferred service or logic.
    // Using encodeURIComponent ensures the seed works correctly in the URL
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(seed)}`;
    // Alternative: https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(seed)}
}
// --- End Helpers ---


// Controller for user login/registration (Passwordless)
const login = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email || !phoneNumber) {
        return res.status(400).json({ success: false, message: 'Email and phone number are required.' });
    }

    // Validate email format (simple check)
    if (!/.+@bennett\.edu\.in$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid Bennett University email address.' });
    }

    try {
        let user = await User.findOne({ email: email });
        let isNewUser = false;

        if (!user) {
            // --- User does not exist, create new user ---
            isNewUser = true;
            const displayName = await generateUniqueDisplayName(); // Generate unique name
            const avatarUrl = generateAvatarUrl(displayName); // Generate avatar based on name

            user = new User({
                email,
                phoneNumber,
                displayName, // Save generated name
                avatarUrl,   // Save generated avatar URL
                // Initialize other fields if necessary
            });
            // Note: accessToken will be generated and saved below
        } else {
            // --- User exists, update phone number if different (optional) ---
            if (user.phoneNumber !== phoneNumber) {
                user.phoneNumber = phoneNumber;
                // Consider if re-verification is needed on phone number change
            }
        }

        // Generate or update access token (simple random token for example)
        const accessToken = crypto.randomBytes(32).toString('hex');
        user.accessToken = accessToken;

        await user.save();

        // Prepare user object for response (exclude sensitive fields like accessToken)
        const userResponse = {
            _id: user._id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            // Include other fields needed by the frontend
        };

        return res.status(200).json({
            success: true,
            message: isNewUser ? 'User registered and logged in successfully.' : 'User logged in successfully.',
            accessToken: accessToken,
            user: userResponse // Send user data back
        });

    } catch (error) {
        console.error('Login/Register error:', error);
        // Handle potential duplicate key error for displayName if unique index is added
        if (error.code === 11000 && error.keyPattern?.displayName) {
             return res.status(400).json({ success: false, message: 'Failed to generate a unique display name. Please try again.' });
        }
        return res.status(500).json({ success: false, message: 'Server error during login/registration.' });
    }
};

module.exports = {
    login
};