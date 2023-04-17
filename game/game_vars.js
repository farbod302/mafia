const game_vars = {
    time: "day",
    turn: -1,
    cur_event: "loading",
    next_event: "pick_carts",
    queue: [],
    day: 1,
    used_rols: [],
    dead_list: [],
    connection_status:[],
    w8:[],
    reval:false,
    vote_type:"pre_vote",
    edit_event(op, event, value) {
        switch (op) {
            case ("edit"): {
                return this[event] = value == "plus" ? this[event] + 1 : value
            }
            case ("push"): {
                return this[event].push(value)
            }
            case ("pull"): {
                return this[event] = this[event].filter(e => e !== value)
            }
            case ("new_value"): {
                return this[event] = value
            }
        }
    },

}

module.exports = game_vars
