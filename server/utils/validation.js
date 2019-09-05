let isRealString = (str) => {
    return typeof str == "string" && str.trim().length > 0 && str.trim().length < 20;
}
module.exports = isRealString;
