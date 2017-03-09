var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let healersCount = (global.cache.creeps["_army"].healers || []).length;
        let friendsCount = (global.cache.creeps["_army"].attackers || []).length - 1;
        let underAttack = creep.memory["lastUnderAttack"] ? 1 : 0;
        if (!("lastHits" in creep.memory))
            creep.memory["lastHits"] = creep.hits;
        if (creep.hits - creep.memory["lastHits"] < 0) {
            creep.say("WTF!");
            underAttack = 2;
            creep.memory["lastUnderAttack"] = 1;
        } else {
            creep.memory["lastUnderAttack"] = 0;
        }
        creep.memory["lastHits"] = creep.hits;

        if (
            (!creep.getActiveBodyparts(ATTACK) && !creep.getActiveBodyparts(RANGED_ATTACK) && healersCount < ARMY_MIN_HEALERS) ||
            (underAttack && friendsCount < ARMY_MIN_FRIENDS)
        ) {
            console.log(creep.name + ": not enough friends (" + friendsCount + ") or healers (" + healersCount + ")");
            creep.moveTo(Game.spawns[creep.memory.spawnName]);
            return;
        }

        if (underAttack) {
            console.log(creep.name + ": is under attack (" + creep.hits + "/" + creep.hitsMax + ")");

            let target;
            let hostiles = creep.room.getNearAttackers(creep.pos, 4);
            if (hostiles.length) {
                target = hostiles.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            } else {
                let towers = _.filter(creep.room.getTowers(), t => t.energy);
                if (towers.length)
                    target = towers.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            }

            if (target) {
                if (creep.attack(target) == ERR_NOT_IN_RANGE)
                    creep.moveTo(target);
                return;
            }

            if (underAttack > 1)
                console.log(creep.name + ": attack from uknown object");
        }

        /*
        let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	    if(flags.length) {
            let flag = flags.sort()[0];
            if (creep.room.name != flag.pos.roomName) {
                if (healer && creep.pos.getRangeTo(healer) < 3 || creep.pos.x == 0 || creep.pos.y == 0)
                    creep.moveTo(flag);
                else if (healer)
                    creep.moveTo(healer);
                return;
            } else {
                let target = 
                    //Game.getObjectById(Memory.targets[creep.room.name]) ||
                    _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK)}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER})
                ;
                if (target) {
                    //Memory.targets[creep.room.name] = target.id;
                    if (creep.attack(target) == ERR_NOT_IN_RANGE)
                        creep.moveTo(target);
                } else {
                    creep.moveTo(flag);
                }
            }
        } else {
            creep.moveTo(Game.spawns[creep.memory.spawnName]);
        }
        */
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
        if (mnum * 2 + body.length > 50) // Body parts limit
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
profiler.registerObject(role, 'roleAttacker');