let socket = io();

function deparam(uri){
    if(uri === undefined){
      uri = window.location.search;
    }
    var queryString = {};
    uri.replace(
      new RegExp(
        "([^?=&]+)(=([^&#]*))?", "g"),
        function($0, $1, $2, $3) {
        	queryString[$1] = decodeURIComponent($3.replace(/\+/g, '%20'));
        }
      );
    return queryString;
};



let app = new Vue({
    el: '#app',
    data: {
        currentMessage: '',
        lastKey: '',
        username: deparam(window.location.search).name,
        users: [],
        messages: [],
        can: false,
        showing: false,
        locked: false,
        chatHistory: false,
        taggable: [],
        tagging: false,
        tagName: '@' + deparam(window.location.search).name.toLowerCase().replace(' ','')
    },
    methods: {
        sendMessage: function(){
            socket.emit('createMessage', this.currentMessage, (err) => {
                if(err) alert(err);
            });
            this.currentMessage = '';
        },
        tag: function(on){
            if(on){
                document.getElementById('tagArea').classList.add('show');
                this.tagging = true;
            } else {
                this.tagging = false;
                document.getElementById('tagArea').classList.remove('show');
            }
        },
        tagPerson: function(name){
            const index = this.currentMessage.lastIndexOf('@');
            this.currentMessage = this.currentMessage.slice(0, index + 1) + name.replace(' ', '');
        },
        toggleUpload: function(){
            this.showing = !this.showing;
            const upload = document.getElementsByClassName('box')[0];
            const app = document.getElementById('app');
            if (this.showing) {
                upload.classList.add('active');
                app.classList.add('active');
            } 
            else {
                upload.classList.remove('active');
                app.classList.remove('active');
            }
        },
        toggleChatHistory: function(read = false) {
            socket.emit('toggleChatHistory', read, (status) => {
                this.chatHistory = status;
            })
        },
        toggleChatLock: function(read = false) {
            socket.emit('toggleChatLock', read, (status) => {
                this.locked = status;
            })
        },
        seeChatHistory: function() {
            window.location.href = window.location.origin + '/chatLogs/' + deparam(window.location.search).room;
        },
        emergency: function() {
            socket.emit('emergency', (status) => {
                this.locked = status;
            });
        },
    },
    watch: {
        currentMessage: function(val, oldVal) {
            if (val.lastIndexOf('@') > val.lastIndexOf(' ')) {
                const name = val.slice(val.lastIndexOf('@') + 1).toLowerCase();
                this.taggable = this.users.filter(user => user.name.toLowerCase().replace(' ', '').includes(name)).slice(0, 5);
                if('everyone'.includes(name)) {this.taggable.push({name:"everyone"})};
                this.tag(true);
            } else {
                this.tag(false);
            }
        }
    },
    mounted: function(){
        const params = deparam(window.location.search);
        socket.emit('join', params, (err) => {
            if(typeof err === 'string'){
                alert(err);
                window.location.href = "/";
            }else if(err === true){
                document.getElementById('adminpanel').classList.add('active');
                this.toggleChatHistory(true);
                this.toggleChatLock(true);
            }
        });

        document.getElementById('title').innerText = `#${params.room}`;

        var div = document.createElement('div');
        this.can = (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window;
        const upload = document.getElementsByClassName('box')[0];

        const uploadImage = file => {
            if( upload.classList.contains( 'is-uploading' ) ) return false;

            upload.classList.add( 'is-uploading' );
            upload.classList.remove( 'is-error' );

            const formData = new FormData();
            formData.append('image', file);

            fetch('/upload', {
                method: 'POST',
                body: formData
            }).then(res => res.json())
            .then(res => {
                upload.classList.remove('is-uploading');

                this.toggleUpload();
                this.currentMessage = {url: `https://conorchat.s3.amazonaws.com/${res.filename}`};
                this.sendMessage();
            });
        }

        if (this.can) {
            upload.classList.add('has-advanced-upload')

            upload.addEventListener('drag', e => {
                e.preventDefault();
                e.stopPropagation();
            })
            upload.addEventListener('dragstart', e => {
                e.preventDefault();
                e.stopPropagation();
            })
            upload.addEventListener('dragend', e => {
                e.preventDefault();
                e.stopPropagation();
                upload.classList.remove('is-dragover');

                console.log('testa');
            })
            upload.addEventListener('dragover', e => {
                e.preventDefault();
                e.stopPropagation();
                upload.classList.add('is-dragover');
            })
            upload.addEventListener('dragenter', e => {
                e.preventDefault();
                e.stopPropagation();
                upload.classList.add('is-dragover');
            })
            upload.addEventListener('dragleave', e => {
                e.preventDefault();
                e.stopPropagation();
                upload.classList.remove('is-dragover');
            })
            upload.addEventListener('drop', e => {
                e.preventDefault();
                e.stopPropagation();
                upload.classList.remove('is-dragover');

                uploadImage(e.dataTransfer.files[0]);
            })

            const input = document.getElementById("fileinput");
            input.addEventListener('change', e => {
              uploadImage(e.target.files[0])
            })
        }

        const urlinput = document.getElementById("urlinput");
        urlinput.addEventListener('change', e => {
            this.currentMessage = {url: urlinput.value};
            this.sendMessage();
            urlinput.value = '';
            this.toggleUpload();
        })
    }
})


socket.on('connect', function(){
    app.messages.push({id:app.messages.length,name: 'Client' , text:"Connected to server"});
});

socket.on('updateUserList', function(users){
    app.users = users;
});
socket.on('disconnect', function() {
    app.messages.push({id:app.messages.length,name: 'Client' , text:"Disconnected from server"});
});

socket.on('newMessage', addMessage);

socket.on('clearChat', () => {
    app.messages = [];
})

function addMessage(message) {
    if(message.url) {
        imageExists(message.url, (exists) => {
            if (exists) {
                app.messages.push(Object.assign(message,{id:app.messages.length}))
                let clientHeight = app.$refs.messages.clientHeight;
                let scrollTop = app.$refs.messages.scrollTop;
                let scrollHeight = app.$refs.messages.scrollHeight;
                if(clientHeight  + scrollTop + 40 >= scrollHeight){
                    setTimeout(function(){
                        app.$refs['message'+(app.messages.length-1)][0].scrollIntoView();
                    },5)
                }
            } else {
                return;
            }
        })
    } else {
        app.messages.push(Object.assign(message,{id:app.messages.length, highlight: (
            message.text.toLowerCase().includes(app.tagName) || message.text.toLowerCase().includes('@everyone')
        )}));
        let clientHeight = app.$refs.messages.clientHeight;
        let scrollTop = app.$refs.messages.scrollTop;
        let scrollHeight = app.$refs.messages.scrollHeight;
        if(clientHeight  + scrollTop + 40 >= scrollHeight){
            setTimeout(function(){
                app.$refs['message'+(app.messages.length-1)][0].scrollIntoView();
            },5)
        }
    }
}

socket.on('massMessageList', messages => {
    messages.forEach(addMessage);
})

function test (){
    app.toggleUpload();
}

function imageExists(url, callback) {
    var img = new Image();
    img.onload = function() { callback(true); };
    img.onerror = function() { callback(false); };
    img.src = url;
}