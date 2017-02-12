var utils = require('utils');

Creep.prototype.goFromKeepers = function() {
    let target = this.room.getNearKeeper(this.pos, 10) || this.room.getNearComingLair(this.pos, 10);
    if (!target)
        return -7;
    let safePlace = this.pos.findClosestByPath(utils.getRangedPlaces(this, target.pos, 6));
    return this.moveTo(safePlace ? safePlace : Game.rooms[this.memory.roomName].controller); 
}

Creep.prototype.attackNearHostile = function(range) {
    let target = this.room.getNearHostile(this.pos, range || 5);
    if (!target)
        return -7;
    
    if (creep.attack(target) == ERR_NOT_IN_RANGE)
        creep.moveTo(target);
    return 0;
}