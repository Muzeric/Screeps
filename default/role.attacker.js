var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        /*
        //  Prepare
        let healersCount = (global.cache.creeps["_army"].healers || []).length;
        let friendsCount = (global.cache.creeps["_army"].attackers || []).length - 1;
        let army_ready = friendsCount >= ARMY_MIN_FRIENDS && healersCount >= ARMY_MIN_HEALERS;
        let canAttack = creep.getActiveBodyparts(ATTACK);
        let canRanged = creep.getActiveBodyparts(RANGED_ATTACK);
        let underAttack = creep.memory["lastUnderAttack"] ? 1 : 0;
        if (!("lastHits" in creep.memory))
            creep.memory["lastHits"] = creep.hits;
        if (creep.hits < creep.memory["lastHits"]) {
            creep.say("WTF!");
            underAttack = 2;
            creep.memory["lastUnderAttack"] = 1;
        } else {
            creep.memory["lastUnderAttack"] = 0;
        }
        creep.memory["lastHits"] = creep.hits;
        // end of prepare

        // Answer mode
        if ( (!canAttack && !canRanged && !healersCount) ) {
            console.log(creep.name + ": no attack parts and no healers");
            creep.moveTo(Game.spawns[creep.memory.spawnName]);
            return;
        }

        if (underAttack) {
            console.log(creep.name + ": is under attack (" + creep.hits + "/" + creep.hitsMax + ")");

            let target;
            let hostiles = creep.room.getNearAttackers(creep.pos, 3);
            if (hostiles.length) {
                target = hostiles.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            } else {
                if (underAttack > 1 && !army_ready) {
                    console.log(creep.name + ": not enough friends (" + friendsCount + ") or healers (" + healersCount + ")");
                    creep.moveTo(Game.spawns[creep.memory.spawnName]);
                    return;
                }
                let towers = _.filter(creep.room.getTowers(), t => t.energy);
                if (towers.length)
                    target = towers.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            }

            if (target) {
                console.log(creep.name + ": attacks target: " + JSON.stringify(target));
                if (canRanged)
                    creep.rangedAttack(target);
                if (canAttack && creep.attack(target) == ERR_NOT_IN_RANGE)
                    creep.moveTo(target);
                return;
            }

            if (underAttack > 1) {
                console.log(creep.name + ": attacked from uknown object");
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
                return;
            }
        }
        // end of answer mode

        // attack mode
        let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
        if (!flags.length) {
            console.log(creep.name + ": no attack flags, go home and recycle");
            let spawn = Game.spawns[creep.memory.spawnName];
            if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE)
                creep.moveTo(spawn);
            return;
        }

        let flag = flags.sort()[0];
        if (!army_ready && creep.room.name != flag.pos.roomName) {
            creep.say("Wait pair");
            return;
        }

        let leader = global.cache.creeps["_army"].attackers.sort((a,b) => a.localeCompare(b))[0];

        if (creep != leader) {
            if (leader.attackID) {
                let target = Game.getObjectById(leader.attackID);
                if (!target) {
                    console.log(creep.name + ": bad attack object (" + leader.attackID + ") from leader (" + leader.name + ")");
                    creep.moveTo(leader);
                    return;
                }
                if (target.pos.roomName != creep.room.name || creep.pos.getRangeTo(target) > 3) {
                    creep.moveTo(target);
                    return;
                }

                if (canRanged)
                    creep.rangedAttack(target);
                if (canAttack && creep.attack(target) == ERR_NOT_IN_RANGE)
                    creep.moveTo(target);
                return;
            } else {
                creep.moveTo(leader);
                return;
            }
        }

        if (creep.room.name != flag.pos.roomName) {
            
        }
        */

        let healer = _.filter(Game.creeps, c => c.memory.role == "healer" && c.memory.attackerID == creep.id)[0];
        let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	    if(flags.length) {
            let flag = flags.sort()[0];
            if (creep.room.name != flag.pos.roomName) {
                if (healer && creep.pos.getRangeTo(healer) < 3 || creep.pos.isBorder())
                    creep.moveTo(flag, {ignoreHostiled: 1});
                else if (healer)
                    creep.moveTo(healer, {ignoreHostiled: 1});
                return;
            } else {
                let target = 
                    //Game.getObjectById(Memory.targets[creep.room.name]) ||
                    _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: c => c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(HEAL) }) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS) ||
                    creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER})
                ;
                if (target) {
                    //Memory.targets[creep.room.name] = target.id;
                    if (creep.attack(target) == ERR_NOT_IN_RANGE)
                        creep.moveTo(target, {ignoreHostiled: 1});
                } else {
                    creep.moveTo(flag, {ignoreHostiled: 1});
                }
            }
        } else {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (creep.pos.isNearTo(spawn))
                if (creep.hits < creep.hitsMax * 0.95)
                    spawn.renewCreep(creep);
            else 
                creep.moveTo(spawn, {ignoreHostiled: 1});
        }
        
	},
	
    create: function(energy) {
        let body = [];
        let tnum = 5;
        let mnum = tnum;
        while(tnum-- > 0 && energy >= 10) {
            body.push(TOUGH);
            energy -= 10;
        }
        while(mnum-- > 0 && energy >= 50) {
            body.push(MOVE);
            energy -= 50;
        }
        
        mnum = Math.floor(energy / (50+80));
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