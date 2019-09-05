

function message(name, text, color, url = false){
    const today = new Date();
    return {
        url,
        name,
        text,
        createdAt: today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate() + ' ' + today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds(),
        color
    };
}

module.exports = message;
