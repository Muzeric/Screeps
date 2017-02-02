var utils = require('utils');

var role = {

    run: function(creep) {
        let stopPoint;
        if (Memory.stopPoint)
            stopPoint = new RoomPosition(Memory.stopPoint.x, Memory.stopPoint.y, Memory.stopPoint.roomName);
        
        if (stopPoint) {
            //console.log(creep.name + ": go to stopPoint " + stopPoint.roomName + ":" + stopPoint.x + "," + stopPoint.y);
            creep.moveTo(stopPoint);
            return;
        }

        if (!creep.getActiveBodyparts(ATTACK)) {
            let healer = creep.pos.findClosestByPath(FIND_MY_CREEPS, {filter: c => c.memory.role == "healer"});
            if (!healer)
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
            else
                creep.moveTo(healer);
            return;
        }

        let target;
        if (Memory.attackTargetID) {
            target = Game.getObjectById(Memory.attackTargetID);
        } else {
            let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	        if(flags.length) {
                let flag = flags.sort(function(a,b) {return a.pos.x - b.pos.x;})[0];
                let targets = flag.pos.lookFor(LOOK_STRUCTURES);
                if (targets.length)
                    target = targets[0];
                else
                    creep.moveTo(flag);
	        }
        }

        if (!target)
            target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        
        if (target) {
            //console.log(creep.name + ": go to attackTarget " + Memory.attackTargetID);
            if (creep.attack(target) == ERR_NOT_IN_RANGE)
                creep.moveTo(target);
            return;
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