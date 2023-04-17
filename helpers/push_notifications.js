const { default: axios } = require("axios")

const push_notification = (device_id, title, content) => {
    let type = typeof device_id
    axios.post('https://api.pushe.co/v2/messaging/notifications/', {
        app_ids: process.env.APP_ID,
        filters: {
            device_id: type === "object" ? device_id : [device_id],
        },
        data: { title, content }

    }, {
        headers: {
            "authorization": process.env.POSHE,
            "content-type": 'application/json'
        }
    })


}

module.exports = { push_notification }