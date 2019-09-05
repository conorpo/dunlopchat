const roomService = {
    rooms: [],
    getRoom: function(roomId) {
        for(let i = 0; i < roomService.rooms.length; i++){
            if (roomService.rooms[i].id === roomId){
                return roomService.rooms[i];
            }
        }
        return false;
    },
    makeRoom: function(roomId) {
        if(this.getRoom(roomId)) return;
    
        const room = {
            id: roomId,
            users: [],
            messageHistory: [],
            history: false,
            timeout: null,
            locked: false,
            mutedMembers: [],
            censoredMembers: [],
            addUser: function(id,name,room,color,admin) {
                const user = {id,name,room,color,admin};
                this.users.push(user);
                return user;
            },
            removeUser: function(id) {
                for(let i = 0; i < this.users.length; i++){
                    const user = this.users[i];
                    if (user.id === id){
                        this.users.splice(i,1);
                        return user;
                    }
                }
                return false;
            },
            getUserList: function() {
                return this.users.map(user => ({name: user.name , color:user.color}));
            },
            empty: function() {
                return this.users.length === 0;
            }
        }
        roomService.rooms.push(room);
        return room;
    },
    removeRoom: function(roomId) {
        for(let i = 0; i < roomService.rooms.length; i++){
            const room = roomService.rooms[i];
            if (room.id === roomId){
                roomService.rooms.splice(i,1);
                return room;
            }
        }
        return false;
    }
};

module.exports = roomService;
