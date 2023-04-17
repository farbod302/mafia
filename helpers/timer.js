const { uid } = require("uid")

const times = {
    speach: 40,
    chalenge: 30,
    cart: 5,
    shote: 15,
    role: 15
}



const Timer = class {
    constructor(io) {
        this.socket = io
        this.temp_list = []
    }
    setTimer(socket_id, data) {
        const  req_time =data?.req_time || 15
        let time = times[req_time]
        let now = Date.now()
        let end_time = now += (1000 * time)
        const timer_uid = uid(3)
        this.temp_list.push({ socket_id, end_time, timer_uid })
    }
    checkTimer(_this) {
        let now = Date.now()
        let timers = _this.temp_list.filter(e => e.end_time < now)
        let all_ids = timers.map(e => e.timer_uid)
        timers.forEach(t => {
            const { socket_id } = t
            _this.socket.to(socket_id).emit("time_end")
        })
        _this.temp_list = _this.temp_list.filter(e => !all_ids.includes(e.timer_uid))
    }

    cancelTimer(socket_id) {
        this.temp_list = this.temp_list.filter(e => e.socket_id != socket_id)
    }

    run_listener() {
        setInterval(()=>{this.checkTimer(this)}, 1000);
    }
}


module.exports = Timer