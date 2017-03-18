const profiler = require('screeps-profiler');

function _addPosition (creep, res, pos, x, y) {
    let newx = parseInt(pos.x) + parseInt(x);
    if (newx < 1 || newx > 48)
        return;
    let newy = parseInt(pos.y) + parseInt(y);
    if (newy < 1 || newy > 48)
        return;
    let npos = new RoomPosition(newx, newy, pos.roomName);
    for (let t of npos.lookFor(LOOK_TERRAIN)) {
        if (t == "wall")
            return;
    }
    if (creep) {
        for (let c of npos.lookFor(LOOK_CREEPS)) {
            if (c != creep)
                return;
        }
    }
    res.push(npos);
}

var utils = {
    clamp : function (n, min, max) {
        return n < min ? min : (n > max ? max : n);
    },

    getRangedPlaces : function (creep, pos, range) {
        let res = [];
        for (let x = -1 * range; x <= range; x++)
            for (let y of [-1 * range,range])
                _addPosition(creep, res, pos, x, y);
        for (let y = -1 * range + 1; y <= range - 1; y++)
            for (let x of [-1 * range,range])
                _addPosition(creep, res, pos, x, y);

        return res;
    },
   
    try_attack : function (creep, all) {
        let target;
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType == STRUCTURE_TOWER});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS, {ignoreDestructibleStructures : true});
        if(!target)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {ignoreDestructibleStructures : true});
        if(!target && all)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {ignoreDestructibleStructures : true, filter : s => s.structureType != STRUCTURE_CONTROLLER});
        /*
        if(!target && creep.memory.targetID && Game.getObjectById(creep.memory.targetID))
            target = Game.getObjectById(creep.memory.targetID);
        let con_creep = _.filter(Game.creeps, c => c.memory.role == "defender" && c.room == creep.room && c.memory.targetID && c != creep)[0];
        if(con_creep && (!creep.memory.targetID || creep.memory.targetID!=con_creep.memory.targetID) && Game.getObjectById(con_creep.memory.targetID)) {
            target = Game.getObjectById(con_creep.memory.targetID);
            console.log(creep.name + " found con_creep " + con_creep.name + " with target=" + con_creep.memory.targetID);
        }
        */
        if(target) {
            creep.memory.targetID = target.id;
            if(!creep.getActiveBodyparts(ATTACK)) {
                console.log(creep.name + " has no ATTACK parts, but hostile in room, go away");
                return 0;
            }
            if (Game.time % 10 == 0)
                console.log(creep.name +
                    " attacks: owner=" + (target.owner ? target.owner.username : 'no owner') +
                    "; ticksToLive=" + target.ticksToLive +
                    "; hits=" + target.hits + 
                    "; structureType=" + target.structureType
                );
            let res = creep.attack(target);
            if(res == ERR_NOT_IN_RANGE) {
                let res = creep.moveTo(target); //, {ignoreDestructibleStructures : (creep.room.controller.my ? false : true)});
                //let res = creep.moveTo(target);
                if(res < 0) {
                    //console.log(creep.name + " moved in attack with res=" + res);
                }
            } else if (res < 0) {
                console.log(creep.name + " attacked with res=" + res);
            }
            return 1;
        }
    	return -1;
    },

    checkInRoomAndGo : function (creep) {
        if (creep.pos.roomName == creep.memory.roomName)
            return 1;

        if(!Game.rooms[creep.memory.roomName])
            console.log(creep.name + ": no room " + creep.memory.roomName);
        else 
            creep.moveTo(Game.rooms[creep.memory.roomName].controller);

        return 0;
    },
    
    lzw_encode: function (s) {
        var dict = {};
        var data = (s + "").split("");
        var out = [];
        var currChar;
        var phrase = data[0];
        var code = 256;
        for (var i=1; i<data.length; i++) {
            currChar=data[i];
            if (dict[phrase + currChar] != null) {
                phrase += currChar;
            }
            else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase=currChar;
            }
        }
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        for (var i=0; i<out.length; i++) {
            out[i] = String.fromCharCode(out[i]);
        }
        return out.join("");
    },
    
    // Decompress an LZW-encoded string
    lzw_decode: function (s) {
        var dict = {};
        var data = (s + "").split("");
        var currChar = data[0];
        var oldPhrase = currChar;
        var out = [currChar];
        var code = 256;
        var phrase;
        for (var i=1; i<data.length; i++) {
            var currCode = data[i].charCodeAt(0);
            if (currCode < 256) {
                phrase = data[i];
            }
            else {
               phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict[code] = oldPhrase + currChar;
            code++;
            oldPhrase = phrase;
        }
        return out.join("");
    },
};

module.exports = utils;
profiler.registerObject(utils, 'utils');