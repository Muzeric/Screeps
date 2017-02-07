var roomConfig = {
    "W48N4" : {
        "repairLimit" : 1040000,
    },
    "W49N4" : {
        "repairLimit" : 1000000,
    },
    "W48N5" : {
        "repairLimit" : 1000000,
    },
};

function _clamp (n, min, max) {
    return n < min ? min : (n > max ? max : n);
}

function _addPosition (res, pos, x, y) {
    let newx = parseInt(pos.x) + parseInt(x);
    if (newx < 0 || newx > 49)
        return;
    let newy = parseInt(pos.y) + parseInt(y);
    if (newy < 0 || newy > 49)
        return;
    let npos = new RoomPosition(newx, newy, pos.roomName);
    let passing = 1;
    for(let t of npos.lookFor(LOOK_TERRAIN)) {
        if (t == "wall")
            passing = 0;
    }
    if (passing)
        res.push(npos);
}

module.exports = {
    roomConfig : roomConfig,

    getRangedPlaces : function (pos, range) {
        let res = [];
        for (let x = -1 * range; x <= range; x++)
            for (let y of [-1 * range,range])
                _addPosition(res, pos, x, y);
        for (let y = -1 * range + 1; y <= range - 1; y++)
            for (let x of [-1 * range,range])
                _addPosition(res, pos, x, y);

        return res;
    },

    findSourceAndGo : function (creep, storage_priority) {
        if(!creep.memory.energyID)
            creep.memory.energyID = this.findSource(creep, storage_priority);
        this.gotoSource(creep);
    },

    findSource : function (creep, storage_priority) {
        let targets = [];
        if (!creep.room.find(FIND_HOSTILE_CREEPS).length)
            targets = creep.room.find(FIND_DROPPED_ENERGY, { filter: r => r.amount > 50 });
        
        targets = targets.concat( creep.room.find(FIND_STRUCTURES, { filter: s =>
            (
                s.structureType == STRUCTURE_CONTAINER && 
                _.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == s.id)
            ) ||
            (
                s.structureType == STRUCTURE_STORAGE && 
                s.store[RESOURCE_ENERGY] > creep.carryCapacity
            )
        }));

        if (creep.getActiveBodyparts(WORK))
            targets = targets.concat(creep.room.find(FIND_SOURCES));

        if(!targets.length) {
            console.log(creep.name + " no any source in room " + creep.room.name);
            return;
        }

        let targetInfo = {};
        for(let target of targets) {
            let cenergy = target.resourceType ? target.amount : (target.structureType ? target.store[RESOURCE_ENERGY] : target.energy);
            let cpath = creep.pos.getRangeTo(target);
            let wantEnergy = _.reduce(_.filter(Game.creeps, c => c.memory.energyID == target.id), function (sum, value) { return sum + value.carryCapacity; }, 0);
            let cpriority = 0;
            if (target.resourceType) { // Dropped
                cpriority = 1.5;
            } else if (storage_priority && target.structureType == STRUCTURE_STORAGE || !storage_priority && target.structureType == STRUCTURE_CONTAINER) {
                cpriority = 2; 
            } else if (target.energy) { // Source
                if (_.filter(Game.creeps, c => c.memory.energyID == target.id && (c.memory.role == "longminer" || c.memory.role == "miner")).length)
                    cpriority = -100;
                else
                    cpriority = -2;
            }

            let cenergyTicks = (wantEnergy + creep.carryCapacity - cenergy) / 10;
            //if (cenergyTicks < 0 && !target.resourceType)
            //    cenergyTicks = 0;
            targetInfo[target.id] = cpath * 1.2 + cenergyTicks - 100 * cpriority;
            //if (creep.room.name == "W46N4")
            //    console.log(creep.name + " [" + creep.room.name + "] has target " + target.id + " in " + cpath + " with " + cenergy + " energy and " + wantEnergy + " wanted and cpriotiy=" + cpriority + " sum=" + targetInfo[target.id]);
        }
        let target = targets.sort( function (a,b) {
            let suma = targetInfo[a.id];
            let sumb = targetInfo[b.id];
            //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
            return suma - sumb;
        })[0];
        
        //console.log(creep.name + " got target " + target.id + " in " + cont_info[target.id].cpath + " with " + cont_info[target.id].cenergy + " energy");
        return target.id;
    },
    
    gotoSource : function(creep) {
        let source = Game.getObjectById(creep.memory.energyID);
        if(!source) {
            console.log(creep.name + " can't get source with enegryID=" + creep.memory.energyID);
            creep.memory.energyID = null;
            return;
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_CONTAINER &&
            !_.sum(Game.creeps, (c) => (c.memory.role == "miner" || c.memory.role == "longminer") && c.memory.cID == source.id)
        ) {
            //console.log(creep.name + " has source=container without miners");
            creep.memory.energyID = null;
            return;
        /*
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_CONTAINER &&
            source.store[RESOURCE_ENERGY] < creep.carryCapacity
        ) {
            console.log(creep.name + " has source=container without energy");
            creep.memory.energyID = null;
            return;
        */
        } else if (
            source.structureType &&
            source.structureType == STRUCTURE_STORAGE &&
            source.store[RESOURCE_ENERGY] < creep.carryCapacity
        ) {
            //console.log(creep.name + " has source=storage without enough energy");
            creep.memory.energyID = null;
            return;
        }

        let lair;
        if (lair = creep.pos.findInRange(FIND_STRUCTURES, 10, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR && s.ticksToSpawn < 10})[0] ) {
            let safePlace = creep.pos.findClosestByPath(this.getRangedPlaces(lair.pos, 6));
            creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
            return;
        }

        let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10, {filter: c => c.owner.username == "Source Keeper"});
        if (hostiles.length) {
            let safePlace = creep.pos.findClosestByPath(this.getRangedPlaces(hostiles[0].pos, 6));
            creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
            return;
        }
        
        let res;
        if(source.structureType && (source.structureType == STRUCTURE_CONTAINER || source.structureType == STRUCTURE_STORAGE || source.structureType == STRUCTURE_LINK)) {
            res = creep.withdraw(source, RESOURCE_ENERGY);
        } else if (source.resourceType && source.resourceType == RESOURCE_ENERGY) {
            res = creep.pickup(source);
            if (!res) {
                console.log(creep.name + " picked up resource");
                creep.memory.energyID = null;
                return;
            }
        } else {
            res = creep.harvest(source);
        }
        
        if (res == ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle : {lineStyle: "dotted", stroke : "#"+creep.name.slice(-2)+creep.name.slice(-2)+creep.name.slice(-2) , opacity : 0.5}, costCallback : function(name, cm) { cm.set(4, 43, 255); cm.set(4, 42, 255); cm.set(4, 41, 255); } });
        } else if (res == ERR_NOT_ENOUGH_ENERGY) {
            return;
        } else if (res < 0) {
            console.log(creep.name + " tried to get energy from " + creep.memory.energyID + " with res = " + res);
            creep.memory.energyID = null;
        }
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

    test : function (total_energy) {
        let inEnergy = total_energy;

        total_energy -= 50;
        let body = [CARRY];
        let wlim = 5;
        let fat = 1;
        let mnum = 0;
        while (total_energy >= 100 && wlim) {
            if (total_energy >= 100) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            total_energy -= 100;
	        }
            if ((!mnum || fat/(mnum*2) >= 2) && total_energy >= 50) {
                body.push(MOVE);
	            total_energy -= 50;
                mnum++;
            }
        }

        console.log((inEnergy - total_energy) + ": " + body);
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