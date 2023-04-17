const livekitApi = require('livekit-server-sdk');
const AccessToken = livekitApi.AccessToken;
const RoomServiceClient = livekitApi.RoomServiceClient;
const livekitHost = "http://185.44.112.9:7880"
const svc = new RoomServiceClient(livekitHost, 'devkey', 'secret');


const Voice = {
    async start_room( game_id) {
        const room_name = `${game_id}`
        const opts = {
            name: room_name,
            emptyTimeout: 10 * 60,
        };
        try{
            await svc.createRoom(opts)
        }
        catch(err){
            console.log(err);
        }
    },
    join_room(user, game_id) {
        const at = new AccessToken('devkey', 'secret', {
            identity: `${user}`,
        });
        at.addGrant({ roomJoin: true, room: `${game_id}` });
        const token = at.toJwt();
        return token
    }
}

module.exports=Voice