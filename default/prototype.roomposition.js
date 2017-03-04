RoomPosition.prototype.isBorder = function () {
    return (this.x == 0 || this.x == 49 || this.y == 0 || this.y == 49) ? true : false;
}


RoomPosition.prototype.getKey = function(long) {
    return this.x + "x" + this.y + (long ? this.roomName : '');
}
RoomPosition.prototype.invertBorderPos () {
    let x = this.x == 49 ? 0 : this.x == 0 ? 49 : this.x;
    let y = this.y == 49 ? 0 : this.y == 0 ? 49 : this.y;

    return new RoomPosition(x, y, this.roomName);
}

let origgetDirectionTo = RoomPosition.prototype.getDirectionTo;
RoomPosition.prototype.getDirectionTo = function (pos) {
    if (this.roomName == pos.roomName)
        return origgetDirectionTo.apply(this, arguments);
    
    let dir = _.reduce(Game.map.describeExits(this.roomName), function(a,v,k) {return v == pos.roomName ? k : a;}, 0);
    switch (_.parseInt(dir)) {
        case LEFT:
            if (pos.y > this.y)
                return BOTTOM_LEFT;
            else if (pos.y < this.y)
                return TOP_LEFT;
            break;
        case RIGHT:
            if (pos.y > this.y)
                return BOTTOM_RIGHT;
            else if (pos.y < this.y)
                return TOP_RIGHT;
            break;
        case TOP:
            if (pos.x > this.x)
                return TOP_RIGHT;
            else if (pos.x < this.x)
                return TOP_LEFT;
            break;
        case BOTTOM:
            if (pos.x > this.x)
                return BOTTOM_RIGHT;
            else if (pos.x < this.x)
                return BOTTOM_LEFT;
            break;
        default:
            console.log("getDirectionTo from " + this.roomName + " to " + pos.roomName + " got dir=" + dir);
    }
    return dir;
}