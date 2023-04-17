const TrezSmsClient = require("trez-sms-client");
const client = new TrezSmsClient("farbod302", "eefabass");

const Helper = {
    valideate_phone(phone) {
        phone = phone.toString()
        return phone.length === 11 && phone.startsWith("09")
    },
    generate_random_num() {
        let start = 1000, end = 9999
        return Math.floor(Math.random() * (end - start + 1)) + start;
    },
    send_sms({ phone, msg }) {
        // client.manualSendCode(phone, msg)
    },
    suffel_arr(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array
    },

    async delay(time) {
        return new Promise(resolve => {
            setTimeout(resolve, time * 1000)
        })
    }
}

module.exports = Helper