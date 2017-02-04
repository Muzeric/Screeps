var utils = require('utils');

var role = {

    run: function(creep) {
        if (!("lastHits" in creep.memory))
            creep.memory["lastHits"] = creep.hits;
        let diffHits = creep.hits - creep.memory["lastHits"];
        creep.memory["lastHits"] = creep.hits;

        let healer = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.memory.role == "healer"});
        if (!creep.getActiveBodyparts(ATTACK)) {
            if (!healer)
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
            else
                creep.moveTo(healer);
            return;
        }

        if (diffHits < 0) {
            console.log(creep.name + ": is under attack (" + creep.hits + "/" + creep.hitsMax + ")");
            creep.say("WTF!");

            let target;
            let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK)});
            if (hostiles.length) {
                target = hostiles.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            } else {
                let towers = creep.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER && s.energy});
                if (towers.length)
                    target = towers.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            }

            if (target) {
                if (creep.attack(target) == ERR_NOT_IN_RANGE)
                    creep.moveTo(target);
                return;
            }

            console.log(creep.name + ": attack from uknown object");
        }

        let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	    if(flags.length) {
            let flag = flags.sort()[0];
            if (creep.room.name != flag.pos.roomName) {
                if (!healer || creep.pos.getRangeTo(healer) < 3)
                    creep.moveTo(flag);
                return;
            } else {
                let target = 
                    Game.getObjectById(Memory.targets[creep.room.name]) ||
                    _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK)}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER})
                ;
                if (target) {
                    Memory.targets[creep.room.name] = target.id;
                    if (creep.attack(target) == ERR_NOT_IN_RANGE)
                        creep.moveTo(target);
                } else {
                    creep.moveTo(flag);
                }
            }
        } else {
            creep.moveTo(Game.spawns[creep.memory.spawnName]);
        }
	},
	
    create: function(energy) {
        let body = [];
        let tnum = 0;
        while(tnum-- > 0 && energy >= 60) {
            body.push(TOUGH);
            energy -= 10;
            body.push(MOVE);
            energy -= 50;
        }
        
        let mnum = Math.floor(energy / (50+80));
        if (mnum * 2 + 2 + body.length > 50) // Body parts limit
            mnum = Math.floor((50 - body.length - 2) / 2);
        let anum = mnum;
        while (energy >= 50 && mnum-- > 0) {
            body.push(MOVE);
            energy -= 50;
        }
        while (energy >= 80 && anum-- > 0) {
            body.push(ATTACK);
            energy -= 80;
        }

        return [body, energy];
	},
};

module.exports = role;