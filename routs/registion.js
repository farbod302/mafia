const express = require("express")
const { uid } = require("uid")
const Temp = require("../db/temp")
const router = express.Router()
const User = require("../db/User")
const Helper = require("../helpers/helper")
const Jwt = require("../helpers/jwt")
const RegistSmsHandler = require("../helpers/regist_sms_handler")
const reject = require("../helpers/reject_handler")
const default_avatar = {
    avatar: "0.png",
    tabel: "0.png",
    rols: []
}

router.post("/", async (req, res) => {
    const { device_id } = req.body
    let is_exist = await User.findOne({ device_id })
    if (is_exist) {
        const { uid: player_uid } = is_exist
        const token = Jwt.sign({ uid: player_uid ,device_id})
        res.json({
            status: true,
            msg: "ورود انجام شد",
            data: { token }
        })
        return
    }
    let player_uid = uid(4)
    const new_player = {
        device_id,
        idenity: {
            name: `guest_${player_uid}`,
            phone: null
        },
        uid: player_uid,
        avatar: default_avatar
    }
    new User(new_player).save()
    res.json({
        status: true,
        msg: "ثبت نام انجام شد",
        data: { token: Jwt.sign({ uid: player_uid ,device_id}) }
    })

})


router.post("/sign_up", async (req, res) => {
    console.log(req.body);
    const { device_id, phone, name, userName } = req.body
    let is_user_name_uniq = await User.findOne({ "idenity.userName": userName })
    console.log(is_user_name_uniq);
    if (is_user_name_uniq) {
        res.json({
            status: false,
            msg: "نام کاربری تکراری است",
            data: {
                userName: false
            }
        })
        return
    }
    let is_exist = await User.findOne({
        device_id,
        status: "gust"
    })
    if (!is_exist) return reject(3, res)
    if (!Helper.valideate_phone(phone)) return reject(0, res)
    let code = RegistSmsHandler.send_sms(phone)
    console.log(code);
    new Temp({ device_id, phone, name, userName, code }).save()
    res.json({
        status: "true",
        msg: "کد تایید ارسال شد",
        data: {}
    })
    return
})

router.post("/sign_up_confirm_phone", async (req, res) => {
    const { code, phone } = req.body
    let temp = await Temp.findOne({ code: code, phone: phone, used: false })
    if (!temp) return reject(1, res)
    const { name, userName, device_id } = temp
    await User.findOneAndUpdate({ device_id }, { $set: { idenity: { name, phone, userName }, status: "registed" } })
    res.json({
        status: true,
        msg: "ثبت نام با موفقیت انجام شد",
        data: {}
    })
    await Temp.findOneAndUpdate({ code: code, phone: phone }, { $set: { used: true } })
})

router.post("/log_in", async (req, res) => {
    const { phone, userName } = req.body
    let is_exist = await User.findOne(userName ? { "idenity.userName": userName } : { phone })
    if (!is_exist) return reject(4, res)
    if (!Helper.valideate_phone(phone)) return reject(0, res)
    RegistSmsHandler.send_sms(phone)
    res.json({
        status: "true",
        msg: "کد تایید ارسال شد",
        data: {}
    })
})

router.post("/log_in_confirm_phone", async (req, res) => {

    const { code, phone, device_id } = req.body
    let is_exist = RegistSmsHandler.check_code({ phone, code })
    if (!is_exist) return reject(1, res)
    is_exist = await User.findOne({ "idenity.phone": phone })
    if (!is_exist) return reject(4, res)
    const { uid: user_id } = is_exist
    let token = Jwt.sign({ uid: user_id ,device_id})
    res.json({
        status: true,
        msg: "",
        data: { token }
    })
    await User.findOneAndUpdate({ "idenity.phone": phone }, { $set: { device_id } })


})








module.exports = router