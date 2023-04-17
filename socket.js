const Jwt = require("./helpers/jwt")
const { uid: uuid } = require("uid")
const User = require("./db/User")
const TempDb = require("./helpers/tempDb")
const { push_notification } = require("./helpers/push_notifications")
const Game = require("./game/game")
const Static = require("./helpers/static")
const SocketProvider = class {

    constructor(io) {
        this.io = io
        this.db = new TempDb()
    }

    lunch() {
        this.io.on("connection", (client) => {
            client.on("join", ({ token }) => {
                // const { uid, device_id } = token
                const { uid, device_id } = Jwt.verify(token)
                let user_party = uuid(5)
                let idenity = {
                    socket_id: client.id,
                    party_id: user_party,
                    user_id: uid,
                    device_id
                }
                client.join(user_party)
                client.idenity = idenity
                this.db.add_data("users", idenity)
                this.db.add_data("party", {
                    party_id: user_party,
                    users: [idenity]
                })
            })


            client.on("invite_to_party", async ({ uid }) => {
                const { party_id } = client.idenity
                let user = await User.findOne({ uid }) || { device_id: 1 }
                let party_owner = await User.findOne({ uid: client.uid }) || { idenity: { name: "farbod" } }
                const { device_id } = user
                let is_user_online = this.db.getOne("users", "user_id", uid)
                if (is_user_online) {
                    const { socket_id } = is_user_online
                    client.to(socket_id).emit("party_invitation", { user: party_owner.idenity, to: party_id })
                }
                else {
                    push_notification(device_id, "شما به بازی دعوت شدید!", `کاربر ${party_owner.idenity.name} شمارا به بازی دعوت کرده`)
                }

            })


            client.on("accept_invitation", ({ party_id }) => {

                let s_party = this.db.getOne("party", "party_id", party_id)
                if (!s_party) return
                const { party_id: prv_party } = client.idenity
                client.leave(prv_party)
                client.idenity.party_id = party_id
                client.join(party_id)
                s_party.users = s_party.users.concat(client.idenity)
                this.db.updateOne("party", "party_id", party_id, s_party)
                this.db.removeOne("party", "party_id", prv_party)
                client.to(party_id).emit("party_join", { idenity: client.idenity })

            })

            client.on("leave_party", () => {
                const { party_id, uid } = client.idenity
                client.leave(party_id)
                client.to(party_id).emit("leave_party", { user: client.idenity })
                let prv_party = this.db.getOne("party", "party_id", party_id)
                let { users } = prv_party
                users = users.filter(e => e !== uid)
                prv_party.users = users
                this.db.updateOne("party", "party_id", party_id, prv_party)
                let user_party = uuid(5)
                client.idenity.party_id = user_party
                client.join(user_party)
                this.db.add_data("party", {
                    party_id: user_party,
                    users: [uid]
                })

            })

            client.on("find_robot_game", () => {
                const { party_id } = client.idenity
                client.to(party_id).emit("find_game_started", { user_started: client.idenity })
                let s_party = this.db.getOne("party", "party_id", party_id)
                const { users } = s_party
                let req_space = users.length
                let s_game = this.db.getAll("game_q") || []
                s_game = s_game.find(e => e.remain >= req_space)
                if (!s_game) {
                    //create game queue
                    let game_id = uuid(4)
                    let new_game = {
                        game_id,
                        remain: 1 - req_space,
                        users: users,
                        partys: [party_id]
                    }
                    this.db.add_data("game_q", new_game)
                    this.io.to(party_id).emit("join_status", { users:users.map(e=>{return {...e,avatar:`${Static.url}/files/0.png`}}) })
                    if (req_space === 1) {
                        this.create_game(game_id)
                    }

                }
                else {
                    //join game

                    let { users: prv_users, partys, remain, game_id } = s_game
                    prv_users = prv_users.concat(users)
                    remain = remain -= req_space
                    partys.push(party_id)
                    let updated_game = {
                        game_id,
                        users: prv_users,
                        remain,
                        partys
                    }
                    for (let party of partys) {
                        this.io.to(party).emit("join_status", { users:prv_users.map(e=>{return {...e,avatar:`${Static.url}/files/0.png`}}) })
                    }
                    this.db.replaceOne("game_q", "game_id", game_id, updated_game)
                    if (remain === 0) {
                        this.create_game(game_id)
                    }

                }
            })

            client.on("leave_find", () => {

                const { party_id } = client.idenity
                let all_games = this.db.getAll("game_q")
                let s_party = this.db.getOne("party", "party_id", party_id)
                let { users } = s_party
                users = users.map(e => e.user_id)
                let s_game = all_games.find(e => e.partys.includes(party_id))
                if (!s_game) return
                let { users: prv_users, partys, remain, game_id } = s_game
                prv_users = prv_users.filter(e => !users.includes(e.user_id))
                partys = partys.filter(e => e !== party_id)
                remain += users.length
                let updated_game = {
                    game_id,
                    users: prv_users,
                    remain,
                    partys
                }
                this.db.replaceOne("game_q", "game_id", game_id, updated_game)
                for (let p of partys) {
                    this.io.to(p).emit("join_status", { users:prv_users.map(e=>{return {...e,avatar:`${Static.url}/files/0.png`}}) })
                }
                this.io.to(party_id).emit("find_stop")

            })


            client.on("game_handle", ({ op, data }) => {
                const { uid, user_game_id } = client.idenity
                if (user_game_id) {
                    client.game_id = user_game_id
                }
                const user_game = this.db.getOne("game", "game_id", client.idenity.game_id) || this.find_user_game(uid)
                user_game.game_calss.game_handelr(op, client, data)

            })

        })


    }

    create_game(game_q_id) {
        let s_game = this.db.getOne("game_q", "game_id", game_q_id)
        if (!s_game) return
        const game_id = uuid(4)
        const { users, partys } = s_game
        let new_game = {
            mod: "robot",
            users,
            modrators: [],
            game_id,
        }

        //create game class
        let game = new Game({ users, socket: this.io, game_id })
        this.db.add_data("game", { ...new_game, game_calss: game })
        //create voice bridge
        this.db.add_data("game", new_game)
        for (let party of partys) {
            this.io.to(party).emit("game_found", { game_id })
        }
        users.forEach(user => {
            this.io.sockets.sockets.get(user.socket_id).join(game_id);
        })



    }


    find_user_game(uid) {
        let all_games = this.db.getAll("game")
        let s_game = all_games.find(g => {
            let { users } = g
            users = users.map(e => e.uid)
            return users.includes(uid)
        })
        return s_game

    }

}

module.exports = SocketProvider