const mongoose = require("mongoose")



const user = mongoose.Schema({

    idenity: Object,
    avatar: Object,
    uid: String,
    gold: { type: Number, default: 10 },
    friend_limit: { type: Number, default: 20 },
    points: {
        type: Object,
        default: {
            win: 0,
            lose: 0,
            abdon: 0,
            com_report: 0,
            role_report: 0
        }
    },
    ranking: { type: Object, default: { xp: 0, rank: 1500, medal: 0 } },
    achivments: { type: Array, default: [] },
    items: { type: Array, default: [] },
    friend_list: { type: Array, default: [] },
    friend_list_req: { type: Array, default: [] },
    following: { type: Array, default: [] },
    chanels: { type: Array, default: [] },
    status: { type: String, default: "gust" },
    device_id: String,
    cur_game: { type: String, default: "" }

})


module.exports = mongoose.model("User", user)