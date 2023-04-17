const { delay } = require("../helpers/helper")
const Helper = require("../helpers/helper")
const Voice = require("../helpers/live_kit_handler")
const Static = require("../helpers/static")
const TempDb = require("../helpers/tempDb")
const Timer = require("../helpers/timer")
const game_vars = require("./game_vars")
const Rols = require("./rols")

const Game = class {
    constructor({ users, socket, game_id }) {
        this.users = users
        this.socket = socket
        this.game_id = game_id
        this.timers = []
        this.vars = { ...game_vars }
        this.db = new TempDb()
        let timer = new Timer(socket)
        timer.run_listener()
        this.timer = timer
        this.game_senario = "tv"
        for (let user of users) {
            this.db.add_data("users", user)
        }
    }
    //main cycle

    async cycle() {
        const { next_event } = this.vars
        switch (next_event) {


            case ("pick_carts"): {
                return this.cart_pick_q_start()
            }
            case "start_speech": {
                let alive_list = this.pick_live_users()
                this.vars.edit_event("edit", "queue", alive_list)
                this.vars.edit_event("edit", "turn", -1)
                this.vars.edit_event("edit", "next_event", "speech")
                this.cycle()
                break;
            }
            case ("speech"): {
                this.vars.edit_event("edit", "turn", "plus")
                let { turn, queue } = this.vars
                if (turn === queue.length) {
                    if (!this.vars.reval) {
                        this.vars.edit_event("edit", "cur_event", "mafia_reval")
                        this.vars.edit_event("edit", "next_event", "start_speech")
                        this.reval_mafia()
                        this.vars.edit_event("edit", "reval", true)
                        await delay(3)
                        this.cycle()
                        return
                    }
                    else {
                        console.log(this.vars);
                        let vote_type = this.vars.vote_type === "pre_vote" ? "start_vote" : "start_exit_vote"
                        this.vars.edit_event("edit", "next_event", vote_type)
                        return this.cycle()
                    }
                }
                const { game_id } = this
                await delay(2)
                this.socket.to(game_id).emit("speech_turn", { user: queue[turn].device_id })
                break
            }
            case ("next_player_pre_vote"): {

                const pre_turn = this.vars.turn
                let pre_player = this.vars.queue[pre_turn]
                const { vote_type } = this.vars
                let all_votes = this.db.getAll("vote_recorde")
                const cur_day = this.vars.day
                let vote_count = [...all_votes].filter(e => {
                    if (e.user_id === pre_player.user_id && e.day === cur_day && e.vote_type === vote_type) return true
                })
                this.vars.edit_event("edit", "turn", "plus")
                const { queue, turn } = this.vars
                const { game_id } = this
                this.socket.to(game_id).emit("vote_count", { player: pre_turn, count: vote_count.length })
                if (queue.length === turn) {
                    let users_to_exit_vote = this.count_votes("pre_vote")
                    let users_to_def = users_to_exit_vote.length
                    switch (users_to_def) {
                        // case (1): {
                        //     const { socket_id } = users_to_exit_vote[0]
                        //     this.socket.to(socket_id).emit("choose_target_cover")
                        //     this.vars.edit_event("edit", "queue", [users_to_exit_vote[0]])
                        //     this.vars.edit_event("edit", "next_event", "w8_for_player")
                        //     this.vars.edit_event("edit", "w8", users_to_exit_vote)
                        //     break;
                        // }
                        // case (2): {
                        //     users_to_exit_vote.forEach(user => {
                        //         this.socket.to(user.socket_id).emit("choose_about")
                        //         this.vars.edit_event("edit", "next_event", "w8_for_player")
                        //         this.vars.edit_event("edit", "w8", users_to_exit_vote.map(e => e.user_id))
                        //     })
                        //     break
                        // }
                        default: {
                            if (users_to_exit_vote.length > 0) {
                                this.vars.edit_event("edit", "next_event", "speech")
                                this.vars.edit_event("edit", "vote_type", "exit_vote")
                                this.vars.edit_event("edit", "turn", -1)
                                this.vars.edit_event("edit", "queue", users_to_exit_vote)
                                this.cycle()
                                return
                            }
                            else {
                                this.vars.edit_event("edit", "next_event", "night")
                                console.log("start night");
                                return
                            }
                        }
                    }

                }
                let players = this.pick_live_users()
                console.log({ players });
                let players_can_vote = players.filter(e => e.user_id !== queue[turn].user_id)
                for (let player of players_can_vote) {
                    console.log(player);
                    this.socket.to(player.socket_id).emit("vote_to_player", { user: queue[turn].user_id })
                }
                this.socket.to(queue[turn].socket_id).emit("cant_vote")
                await delay(5)
                this.cycle()
                break
            }
            case ("start_exit_vote"): {
                this.vars.edit_event("edit", "turn", "plus")
                const { queue, turn } = this.vars
                if (queue.length === turn) {
                    this.vars.edit_event("edit", "next_event", "count_exit_votes")
                }
                let players = this.pick_live_users()
                let players_can_vote = []
                if (queue.length > 2) {
                    players_can_vote = players.filter(e => e.user_id !== queue[turn].user_id)
                }
                else {
                    let queue_ids = queue.map(e => e.user_id)
                    players_can_vote = players.filter(e => !queue_ids.includes(e.user_id))
                }
                for (let player of players_can_vote) {
                    this.socket.to(player.socket_id).emit("vote_to_player", { user: queue[turn].user_id })
                }
                await delay(8)
                this.cycle()

            }
            case ("start_vote"): {
                await this.start_vote()
            }


            case ("nigth"): {
                this.start_night()
            }
        }

    }

    // cart suffeling and brodcasts
    shuffel_carts() {
        let rols = [...Rols[this.game_senario]]
        rols = Helper.suffel_arr(rols)
        rols = rols.map(e => { return { cart: e, player: null } })
        this.vars.edit_event("new_value", "carts", rols)
    }
    async cart_pick_q_start() {
        let users = this.db.getAll("users")
        this.vars.edit_event("edit", "queue", users)
        await this.voice_bridge_token_generator()
        this.shuffel_carts()
        console.log("im call from start");
        this.next_player_pick_cart()
    }
    next_player_pick_cart() {
        const carts = [...this.vars.carts]
        let { game_id } = this
        this.vars.edit_event("edit", "turn", "plus")
        const { turn } = this.vars
        if (turn === this.users.length) {
            this.vars.edit_event("edit", "next_event", "start_speech")
            this.socket.to(game_id).emit("game_started")
            this.cycle()
            return
        }
        let user = this.db.getOne("users", "id", turn)
        this.socket.to(this.game_id).emit("pick_cart_phase", { users: this.users, carts, cur_turn: user })
        console.log(carts);
        this.socket.to(user.socket_id).emit("pick_cart")
    }
    reval_mafia() {
        console.log("im cull reval");
        const mafia_rols = [
            "godfather",
            "nato",
            "hostageـtaker",
        ]
        let all_users = this.db.getAll("users")
        let mafia = all_users.filter(e => mafia_rols.includes(e.role))
        this.vars.mafia = mafia
        mafia.forEach(e => {
            this.socket.to(e.socket_id).emit("mafia_list", {
                list: mafia.map(e => {
                    const { id, role, device_id } = e
                    return {
                        avatar: `${Static.url}/files/0.png`,
                        number: id,
                        device_id,
                        role,
                        name: "farbod"
                    }
                })
            })
        })
    }
    game_handelr(op, client, data) {
        const { id } = client
        this.timer.cancelTimer(id)
        switch (op) {
            case ("pick_cart"): {
                const { user_id } = client.idenity
                let carts = [...this.vars.carts]
                const { selected_cart_index } = data
                let user = this.db.getOne("users", "user_id", user_id)
                user["role"] = carts[selected_cart_index].cart
                this.db.updateOne("users", "user_id", user_id, user)
                carts[selected_cart_index].player = user_id
                this.vars.edit_event("edit", "edit", carts)
                this.next_player_pick_cart()
                break
            }
            case ("user_speech_end"): {
                this.cycle()
                break
            }
            case ("user_connection"): {
                this.vars.edit_event("push", "connection_status", client)
                let connected = this.vars.connection_status
                if (connected.length === this.users.length) {
                    //voice_bridge_token
                    this.cycle()
                    break
                }
                break
            }
            case ("vote"): {
                const { day, cur_event, turn, queue } = this.vars
                let user = queue[turn]
                let new_vote = {
                    to: user,
                    from: client.idenity,
                    day,
                    type: cur_event
                }
                this.db.add_data("vote_recorde", new_vote)
                const { game_id } = this.vars
                this.socket.to(game_id).emit("player_voted", { user: client.idenity })
                break
            }


            case ("choose_target_cover"): {

                const { target, cover } = data
                const is_chosen = target ? true : false
                if (is_chosen) {
                    let queue = [target, cover, client]
                    this.vars.edit_event("edit", "next_event", "speech")
                    this.vars.edit_event("edit", "vote_type", "exit_vote")
                    this.vars.edit_event("edit", "turn", -1)
                    this.vars.edit_event("edit", "queue", queue)
                    this.cycle()
                }
                else {
                    this.vars.edit_event("edit", "next_event", "speech")
                    this.vars.edit_event("edit", "vote_type", "exit_vote")
                    this.vars.edit_event("edit", "turn", -1)
                    this.vars.edit_event("edit", "queue", [client.idenity])
                    this.cycle()
                }
                break
            }
            case ("choose_about"): {
                let prv_queue = [...this.vars.queue]
                let { w8 } = this.vars
                const { about } = data
                const is_chosen = about ? true : false
                if (is_chosen) {
                    let queue = [about, client]
                    prv_queue = prv_queue.concat(queue)
                    this.vars.edit_event("edit", "queue", prv_queue)
                    w8 = w8.filter(e => e.user_id !== client.user_id)
                    if (w8.length === 0) {
                        this.vars.edit_event("edit", "next_event", "speech")
                        this.vars.edit_event("edit", "vote_type", "exit_vote")
                        this.vars.edit_event("edit", "turn", -1)
                        this.cycle()
                    }
                }
                break
            }


            case ("mafia_shot"): {
                const { user } = data
                const { day } = this.vars
                let cur_night = this.db.getOne("night_record", "night", day)
                cur_night.records.push({
                    event: "mafia_shot",
                    player: user.user_id
                })
                this.db.replaceOne("night_record", "night", day, cur_night)
                this.cycle()

            }

            case ("host"): {
                const { users } = data
                const { day } = this.vars
                let cur_night = this.db.getOne("night_record", "night", day)
                users.forEach(user => {
                    cur_night.records.push({
                        event: "hostage",
                        player: user.user_id
                    })
                })
                this.db.replaceOne("night_record", "night", day, cur_night)

                this.vars.edit_event("edit", "next_event", "other_acts")
                this.cycle()

            }


            case ("act"): {
                const { users, role } = data
                const { day } = this.vars
                let cur_night = this.db.getOne("night_record", "night", day)
                users.forEach(user => {
                    cur_night.records.push({
                        event: role,
                        player: user.user_id
                    })
                })
                this.db.replaceOne("night_record", "night", day, cur_night)

            }


        }
    }
    pick_live_users() {
        let all_users = this.db.getAll("users")
        const { dead_list } = this.vars
        let alive_list = all_users.filter(e => !dead_list.includes(e.user_id))
        alive_list = alive_list.map(e => {
            const { socket_id, device_id, user_id } = e
            return { socket_id, device_id, user_id }
        })
        console.log({ alive_list });
        return alive_list
    }
    async start_vote() {
        let { vote_type } = this.vars
        let user_to_vote = vote_type === "pre_vote" ? this.pick_live_users() : [...this.vars.vote_to_exit || []]
        console.log(user_to_vote, vote_type);
        const { game_id } = this
        this.vars.edit_event("edit", "queue", user_to_vote)
        this.vars.edit_event("edit", "turn", -1)
        this.vars.edit_event("edit", "cur_event", vote_type === "pre_vote" ? "pre_vote" : "exit_vote")
        await delay(2)
        this.socket.to(game_id).emit("vote_phase")
        await delay(3)
        this.vars.edit_event("edit", "next_event", vote_type === "pre_vote" ? "next_player_pre_vote" : "exit_vote")
        this.cycle()

    }
    async voice_bridge_token_generator() {
        const { game_id, users } = this
        await Voice.start_room(game_id)
        for (let user of users) {
            const { user_id, socket_id } = user
            console.log();
            let token = Voice.join_room(user_id, game_id)
            this.socket.to(socket_id).emit("voice_bridge_token", { token })
        }
    }
    count_votes(type) {
        let live_users = this.pick_live_users()
        const { day } = this.vars
        let all_votes = this.db.getAll("vote_recorde")
        let users_voted = live_users.filter(user => {
            const { user_id } = user
            let user_votes = all_votes.filter(v => v.to.user_id == user_id && v.day === day && v.type === type)
            if (user_votes > 0) return true
        })
        this.vars.vote_to_exit = users_voted
        users_voted.forEach(e => {
            this.db.add_data("voted_for_exit", e)
        })
        return users_voted
    }

    count_exit_votes() {
        const { queue, day, game_id } = this
        let all_votes = this.db.getAll("vote_recorde")
        let users_voted = queue.map(user => {
            const { user_id } = user
            let user_votes = all_votes.filter(v => v.to.user_id == user_id && v.day === day && v.type === "exit_vote")
            return { ...user, count: user_votes.length }
        })
        let max_vote = users_voted.sort((a, b) => b.count - a.count)[0]?.count || 0
        if (max_vote === 0) {
            this.vars.edit_event("edit", "next_event", "start_night")
            this.cycle()
        }
        else {
            let player_has_same_vote = users_voted.filter(e => e.count === max_vote)
            switch (player_has_same_vote.length) {
                case (1): {
                    this.socket.to(game_id).emit("player_kick", { user: player_has_same_vote[0] })
                    this.vars.edit_event("push", "dead_list", player_has_same_vote[0])
                    this.vars.edit_event("edit", "next_event", "start_night")
                    this.cycle()

                    break;
                }
                default:
                    this.vars.edit_event("edit", "next_event", "start_night")
                    this.cycle()
                    break;
            }
        }
    }


    brodcast_event(msg) {
        this.socket.to(this.game_id).emit("nigth_event", { msg })
    }


    async start_night() {
        const { game_id, day } = this.users
        this.vars.edit_event("edit", "time", "night")
        this.socket.to(game_id).emit("time_change", { time: "night" })
        this.vars.edit_event("edit", "next_event", "guard_act")
        this.db.add_data("night_records", { night: day, records: [] })
        await delay(3)
        this.cycle()
    }


    mafia_shot() {
        let mafia_list = this.vars.mafia
        mafia_list = mafia_list.filter(e => e.role !== "hostageـtaker")
        for (let mafia of mafia_list) {
            this.socket.to(mafia.socket_id).emit("mafia_shot_phase")

        }
        this.brodcast_event("mafia_shot")

        let dead_list = [...this.vars.dead_list]
        mafia_list = mafia_list.filter(e => !dead_list.includes(e.user_id))
        let god_father = mafia_list.find(e => e.role === "god_father")

        if (god_father) {
            this.socket.to(god_father.socket_id).emit("make_shot")
        }
        else {
            let nato = mafia_list.find(e => e.role === "nato")
            if (nato) {
                this.socket.to(nato.socket_id).emit("make_shot")
            }
            else {
                this.socket.to(mafia_list[0].socket_id).emit("make_shot")
            }

        }

        this.vars.edit_event("edit", "next_event", "take_hosteg")
    }
    async take_hosteg() {
        let mafia_list = this.vars.mafia
        mafia_list = mafia_list.filter(e => e.role !== "hostageـtaker")
        for (let mafia of mafia_list) {
            this.socket.to(mafia.socket_id).emit("tkae_host_phase")
        }
        let dead_list = [...this.vars.dead_list]
        mafia_list = mafia_list.filter(e => !dead_list.includes(e.user_id))
        let hosteg_taker = mafia_list.find(e => e.role === "hosteg_taker")
        if (hosteg_taker) {
            let live_uesrs = this.pick_live_users()
            this.socket.to(hosteg_taker.socket_id).emit("take_hosteg", { count: live_uesrs.length > 8 ? 2 : 1 })
        }
        else {
            await delay(4)
            this.vars.edit_event("edit", "next_event", "other_acts")
            this.cycle()
        }

    }


    async guard_act() {

        let gurd = this.db.getOne("users", "role", "guard")
        let { dead_list } = this.vars
        this.brodcast_event("gurd")
        if (dead_list.includes(gurd.user_id)) {
            await delay(4)
            this.vars.edit_event("edit", "next_event", "mafia_shot")
            this.cycle()
        }
        else {
            this.socket.emit("gurd_act", { users: this.user_filter("gurd") })
        }

    }


    user_filter(role) {
        let live_users = this.pick_live_users()
        switch (role) {
            case ("doctor"): {
                let { doctor_self_save } = this.vars
                if (doctor_self_save) {
                    return live_users.filter(e => e.role !== "doctor")
                }
            }
            case ("detective"): {
                let already_detected = this.db.getAll("night_record").filter(e => e.event === "detect")
                let already_detected_ids = already_detected.map(e => e.user.player)
                return live_users.filter(e => !already_detected_ids.includes(e.user_id))
            }
            default: {
                return live_users.filter(e => e.role !== role)
            }
        }
    }


    async other_acts() {
        const live_users = this.pick_live_users()
        this.db.replaceOne("night_record", "night", day, cur_night)
        let prv_acts = this.db.getOne("night_records", "night", day)
        const { records } = prv_acts
        let hosteges = [...records.filter(e => e.event === "hosteg")]
        let saved = [...records.filter(e => e.event === "gurd")]
        hosteges = hosteges.map(e => e.player)
        saved = saved.map(e => e.player)
        hosteges = hosteges.filter(e => !saved.includes(e))
        let def_roles = live_users.filter(e => hosteges.includes(e.user_id))
        def_roles = def_roles.map(e => e.role)
        const { day } = this.vars
        prv_acts = prv_acts.filter(e => e.day === day)
        let dis_users = ["citizen", "god_fhater", "nato", "hostageـtaker", "gurd"].concat(def_roles)
        live_users = live_users.filter(e => !dis_users.includes(e.role))
        for (let user of users_with_role) {
            this.socket.to(user.socket_id).emit("night_act", { users: this.user_filter(user.role) })
        }
        await delay(40)
        this.vars.edit_event("edit", "next_event", "night_result")
        this.cycle()

    }


    async night_result() {

        const { day } = this.vars
        const { records } = this.db.getOne("night_records", "night", day)
        //night shot
        let mafia_shot = records.find(e => e.event === "mafia_shot").player

        //commando
        let commando_shot = records.find(e => e.event === "commando")?.player || null
        if (commando_shot) {
            const s_player = this.db.getOne("users", "user_id", commando_shot)
            const { role } = s_player
            if (role === "nato" || role === "hostageـtaker") {
                mafia_shot = commando_shot
            }
            if (role === "god_father") {
                mafia_shot = null
            }
        }

        //doctor_act
        let commando = this.db.getOne("users", "role", "commondo")

        let doctor_save = records.find(e => e.event === "doctor")?.player || null
        if (doctor_save && doctor_save === mafia_shot) {
            if (commando_shot && doctor_save === commando.user_id) {
                mafia_shot = mafia_shot
            }
            else {
                mafia_shot = null
            }
        }
        //detective
        let detective_req = this.db.getOne("users", "role", "detective") || null
        if (detective_req) {
            let req = this.db.getOne("users", "user_id", detective_req)
            let detective = this.db.getOne("users", "role", "detective")
            if (req.role === "nato" || req.role === "hostageـtaker") {
                this.socket.to(detective.socket_id).emit("detect_result", { user: req, is_mafia: true })
            }
            else {
                this.socket.to(detective.socket_id).emit("detect_result", { user: req, is_mafia: false })

            }
        }

        //rifleman






    }

}

module.exports = Game