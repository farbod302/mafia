const JWT = require("jsonwebtoken")
const Jwt = {
    sign(data) {
        return JWT.sign(data, process.env.JWT)
    },
    verify(token){
        try{
            const user=JWT.verify(token,process.env.JWT)
            return user
        }
        catch{
            return false
        }
    }
}

module.exports=Jwt