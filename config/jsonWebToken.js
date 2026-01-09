

const jwt = require('jsonwebtoken');

const generateResetToken = (email) => {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return token;
};

const verifyResetToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = { generateResetToken, verifyResetToken };