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
    for (let s of npos.lookFor(LOOK_STRUCTURES)) {
        if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
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

function _checkPosFree (pos, costs, ext) {
    if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47)
        return false;

    for (let t of pos.lookFor(LOOK_TERRAIN)) {
        if (t == "wall")
            return false;
    }

    if (costs.get(pos.x, pos.y) == 0xff) {
        if (!ext)
            return false;
        for (let s of pos.lookFor(LOOK_STRUCTURES)) {
            if ([STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
                return false;
        }
        return true;
    }

    for (let s of pos.lookFor(LOOK_STRUCTURES)) {
        if ([STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) == -1)
            return false;
    }
    
    return true;
}

var utils = {
    checkPosForExtension : function (pos, costs) {
        if (!_checkPosFree(pos, costs) || 
            !_checkPosFree(pos.change(-1, 0, 1), costs) ||
            !_checkPosFree(pos.change(1, 0, 1), costs) ||
            !_checkPosFree(pos.change(0, -1, 1), costs) ||
            !_checkPosFree(pos.change(0, 1, 1), costs) ||
            !_checkPosFree(pos.change(-1, -1, 1), costs, 1) ||
            !_checkPosFree(pos.change(1, -1, 1), costs, 1) ||
            !_checkPosFree(pos.change(-1, 1, 1), costs, 1) ||
            !_checkPosFree(pos.change(1, 1, 1), costs, 1)
        )
            return false;
        
        return true;
    },

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

    extendX: function() {
        for (order of _.filter(Game.market.orders, o => o.resourceType == "X" && o.type == ORDER_BUY)) {
            Game.market.extendOrder(order.id, 10000);
        }
    },

    terminalInfo: function() {
        for (let room of _.filter(Game.rooms, r => r.terminal)) {
            let print = room.name + ": ";
            for (let rt in room.terminal.store) {
                let order = _.find(Game.market.orders, o => o.resourceType == rt && o.type == ORDER_SELL && roomName == room.name);
                print += rt + "=" + room.terminal.store[rt];
                if (order)
                    print += " (" + order.id + ", p=" + order.price + ", a=" + order.amount + ")";
                print += "; "
            }
        }
    },

    isLowCPU: function(silent) {
        let left = Game.cpu.tickLimit - Game.cpu.getUsed();
        let stop = left < (Game.cpu.bucket < Game.cpu.limit ? CPU_LIMIT_HIGH : CPU_LIMIT_LOW);
        if (!silent && stop) {
            let caller = (new Error()).stack.split('\n')[3].trim();
            console.log("BREAK: cpu left " + _.floor(left) + " stopped at " + caller);
        }
        return stop;
    },

    memoryProfiler: function() {
        let hash = {};
        for (let key in Memory) {
            hash[key] = {};
            hash[key].length = JSON.stringify(Memory[key]).length;
            let cpu = Game.cpu.getUsed();
            let some = JSON.parse(JSON.stringify(Memory[key]));
            hash[key].cpu = Game.cpu.getUsed() - cpu;
        }
        
        let hash2 = {};
        for (let roomName in Memory.rooms) {
            for (let key in Memory.rooms[roomName]) {
                hash2[key] = hash2[key] || {};
                hash2[key].length = (hash2[key].length || 0) + JSON.stringify(Memory.rooms[roomName][key]).length;
                let cpu = Game.cpu.getUsed();
                let some = JSON.parse(JSON.stringify(Memory.rooms[roomName][key]));
                hash2[key].cpu = (hash2[key].cpu || 0) + (Game.cpu.getUsed() - cpu);
            }
        }

        let hash4 = {};
        for (let roomName in Memory.rooms) {
            if (!("structures" in Memory.rooms[roomName]))
                continue;
            for (let structureType in Memory.rooms[roomName]["structures"]) {
                hash4[structureType] = hash4[structureType] || {};
                hash4[structureType].length = (hash4[structureType].length || 0) + JSON.stringify(Memory.rooms[roomName]["structures"][structureType]).length;
                let cpu = Game.cpu.getUsed();
                let some = JSON.parse(JSON.stringify(Memory.rooms[roomName]["structures"][structureType]));
                hash4[structureType].cpu = (hash4[structureType].cpu || 0) + (Game.cpu.getUsed() - cpu);
            }
        }

        for (let coll of [hash, hash2, hash4]) {
            let totalLength = 0;
            let totalCpu = 0;
            for (let key in coll) {
                totalLength += coll[key].length;
                totalCpu += coll[key].cpu;
            }
            console.log("Total: length=" + totalLength + ", cpu=" + _.floor(totalCpu, 1));
            for (let key of _.keys(coll).sort((a, b) => coll[b].cpu - coll[a].cpu) )
                console.log(key + ": " + coll[key].length + "\t" + _.floor(coll[key].cpu, 1));
            console.log("\n");
        }
    },
};

module.exports = utils;
profiler.registerObject(utils, 'utils');