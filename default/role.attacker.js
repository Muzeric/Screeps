var utils = require('utils');

var roleAttacker = {

    run: function(creep) {
        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL))
            console.log(creep.name + " healed himself (" + creep.hits + "/" + creep.hitsMax + ") with res=" + creep.heal(creep));
        
        if ((creep.hits <= 200 || creep.hits < creep.hitsMax * 0.4) && creep.memory.attacking) {
	        creep.memory.attacking = false;
	    } else if (creep.hits == creep.hitsMax && !creep.memory.attacking) {
	        creep.memory.attacking = true;
	    }
	    
        if (creep.pos.roomName == creep.memory.roomName) {
            let res = utils.try_attack(creep);
            if (!res) {
                creep.moveTo(creep.room.controller);
                return;
            } else if (res > 1) {
                return;
            }
        }

        if(!creep.memory.attackName || !Game.flags[creep.memory.attackName]) {
            let targets = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Attack');
	        if(!targets.length) {
	            //console.log(creep.name + " found no flags");
	            creep.memory.attacking = false;
	        } else {
    	        console.log(creep.name + " targets: " + targets);
    	        
    	        creep.memory.attackName = targets.sort()[0].name;
                console.log(creep.name + " attackName=" + creep.memory.attackName);
	        }
        }
        
	    if(creep.memory.attacking) {
            if(creep.room.name == Game.flags[creep.memory.attackName].pos.roomName) {
                if(!utils.try_attack(creep,1)) {
                    creep.memory.attacking = false;
                } 
            } else {
                creep.moveTo(Game.flags[creep.memory.attackName].pos);
                //console.log(creep.name + " going to " + creep.memory.attackName + " to " + exitDir);
	        }
        } else {
            creep.moveTo(Game.rooms[creep.memory.roomName]);
            //Game.spawns[creep.memory.spawnName].recycleCreep(creep);
        }
	},
	
    create: function(spawnName, role, total_energy) {
        let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        total_energy -= 300; // MOVE,HEAL at end
        let body = [];
        let tnum = 10;
        while(tnum-- > 0 && total_energy >= 60) {
            body.push(TOUGH);
            total_energy -= 10;
            body.push(MOVE);
            total_energy -= 50;
        }
        
        let mnum = Math.floor(total_energy / (50+80));
        let anum = mnum;
        while (total_energy >= 50 && mnum-- > 0) {
            body.push(MOVE);
            total_energy -= 50;
        }
        while (total_energy >= 80 && anum-- > 0) {
            body.push(ATTACK);
            total_energy -= 80;
        }
        body.push(MOVE);
        body.push(HEAL);

	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
	    //let newName = 'test';
        return [newName, body, total_energy];
	}
};

module.exports = roleAttacker;