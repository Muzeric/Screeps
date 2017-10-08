const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (
            !(creep.memory.roomName in global.cache.creepsByRoomName) ||
            !("powerminer" in global.cache.creepsByRoomName[creep.memory.roomName]) ||
            !global.cache.creepsByRoomName[creep.memory.roomName]["powerminer"].length
        ) {
            //console.log(creep.name + ": no miners for " + creep.memory.roomName);
            return;
        }

        let miners = _.filter(global.cache.creepsByRoomName[creep.memory.roomName]["powerminer"], c => c.memory.targetPos);
        if (!miners.length) {
            //console.log(creep.name + ": no active miners for " + creep.memory.roomName);
            return;
        }
        let targetPos = miners[0].memory.targetPos;

        if (creep.room.name != targetPos.roomName) {
            let pos = new RoomPosition(targetPos.x, targetPos.y, targetPos.roomName);
            creep.moveTo(pos);
        } else {
            for (let miner of miners.sort()) {
                if (miner.hits < miner.hitsMax) {
                    if (creep.pos.isNearTo(miner)) {
                        creep.heal(miner);
                    } else {
                        creep.moveTo(miner);
                        creep.rangedHeal(miner);
                    }
                    break;
                }
            }
        }
	},
	
    create: function(energy) {
        let body = [];
        
        /*
        body.push(MOVE);
        energy -= 50;
        return [body, energy];
        */
        let hnum = Math.floor(energy / 300);
        energy -= 300 * hnum;
        mnum = hnum;
        
        while (mnum-- > 0)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'rolePowerHealer');