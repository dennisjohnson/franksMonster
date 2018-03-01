let boundingCircleMaker = require('boundingCircle');
const profiler = require('screeps-profiler');

let SECONDS_TO_KEEP_ROOMLAYOUTS = 300;
const IMPASSIBLE = 255;

module.exports = {
    run: run,
    getSourceRecord: getSourceRecord
};


function logObj(o){
    console.log(JSON.stringify(o))
}
function myUsername(){
    return _.find(Game.structures).owner.username;
}
function values(dict){
    return Object.keys(dict).map((k) => dict[k]);
}
function positionsAreEqual(a,b){
    return a.x === b.x && a.y === b.y && a.roomName === b.roomName;
}

function run(){
    takeFlagInputs();
    takeVisibleInputs();
    removeStale();
    evaluateForExpansion();
    establishLayouts();
    drawLayouts();
}

function removeStale(){
    for (let roomName in Memory["roomLayouts"]){
        if (isStale(Memory.roomLayouts[roomName])){
            console.log(roomName + " is stale - deleted");
            delete Memory.roomLayouts[roomName]
        }
    }
}
function isStale(roomLayout){
    return roomLayout.lastUpdatedTime + SECONDS_TO_KEEP_ROOMLAYOUTS < Game.time;
}

function takeFlagInputs(){
    let inputFlags =  values(Game.flags).filter(isWhite);
    for (let flag of inputFlags){
        consumeInput(flag);
    }
}
function isWhite(flag){
    return flag.color === COLOR_WHITE;
}
function consumeInput(flag){
    let roomLayout = getRoomLayout(flag.pos.roomName);
    roomLayout["lastUpdatedTime"]= Game.time;
    if (isWhiteYellow(flag)){
        createSourceRecord(flag.pos);
    }
    if (isWhiteRed(flag)){
        createControllerRecord(flag.pos);
        setExpansionRoom(flag.pos.roomName, true, "inputFlag");
    }
    flag.remove();
}
function isWhiteYellow(flag){
    return flag.color === COLOR_WHITE && flag.secondaryColor === COLOR_YELLOW;
}
function isWhiteRed(flag){
    return flag.color === COLOR_WHITE && flag.secondaryColor === COLOR_RED;
}
function createSourceRecord(pos){
    let roomLayout = getRoomLayout(pos.roomName);
    if (!roomLayout["sources"]){roomLayout["sources"] = {};}
    let posName = getNameFrom(pos);
    if (!roomLayout.sources[posName]){
        roomLayout.sources[posName] = {"pos": pos};
    }
}
function getRoomLayout(roomName){
    if (!roomName) {throw "invalid roomName for layout request"}
    createMissingRoomLayout(roomName);
    return Memory.roomLayouts[roomName];
}
function createMissingRoomLayout(roomName){
    if (!Memory["roomLayouts"]){Memory.roomLayouts = {};}
    if (!Memory.roomLayouts[roomName]){
        Memory.roomLayouts[roomName] = {
            "initializedTime": Game.time,
            "lastUpdatedTime": Game.time,
            "name": roomName
        };
    }
}
function getNameFrom(pos){
    return pos.roomName + "_" + pos.x + "_" + pos.y
}
function createControllerRecord(pos){
    let roomLayout = getRoomLayout(pos.roomName);
    if (!roomLayout["controller"]){roomLayout["controller"] = {};}
    roomLayout.controller = {"pos": pos};
}
function setExpansionRoom(roomName, bool_val, reason){
    let roomLayout = getRoomLayout(roomName);
    setExpansionLayout(roomLayout, bool_val, reason);
}
function setExpansionLayout(roomLayout, bool_val, reason){
    roomLayout["expansionRoom"] = bool_val;
    roomLayout["expansionReason"] = reason
}

function takeVisibleInputs(){
    for(let roomName in Game.rooms){
        let roomLayout = getRoomLayout(roomName);
        roomLayout["lastUpdatedTime"]= Game.time;
        takeVisibleInputsIn(roomName);
    }
}
function takeVisibleInputsIn(roomName){
    let controller = Game.rooms[roomName].controller;
    if(controller){
        createControllerRecord(controller.pos);
    }
    let sources = Game.rooms[roomName].find(FIND_SOURCES);
    if(sources){
        for(let source of sources){
            createSourceRecord(source.pos);
        }
    }
}


function evaluateForExpansion(){
    for(let roomName in Memory.roomLayouts){
        evaluateRoomForExpansion(Memory.roomLayouts[roomName]);
    }
}
function evaluateRoomForExpansion(layout){
    if (layout["expansionReason"]){return;}
    if(isMyRoom(layout.name)){
        setExpansionLayout(layout, true, "already own it");
        return;
    }
    if(isTwoSource(layout)){
        setExpansionLayout(layout, true, "Two sources");
        return;
    }
    setExpansionLayout(layout, false, "no compelling reason to expand here");
}
function isMyRoom(roomName){
    return Game.rooms[roomName]
        && Game.rooms[roomName].controller
        && Game.rooms[roomName].controller.owner
        && Game.rooms[roomName].controller.owner.username === myUsername();
}
function isTwoSource(layout){
    return layout.controller
        && layout.sources
        && layout.sources.length > 1;
}

function establishLayouts(){
    for(let roomName in Memory.roomLayouts){
        establishLayout(roomName);
    }
}
//establishLayouts = profiler.registerFN(establishLayouts, 'establishLayouts');
function establishLayout(roomName){
    let roomLayout = getRoomLayout(roomName);
    let discardExisting = isChangedOrLacking(roomLayout);
    createBoundingCircle(roomLayout, discardExisting);
    createSourceToControllerPaths(roomLayout, discardExisting);
    createRCL1Structures(roomLayout, discardExisting);
}
function isChangedOrLacking(roomLayout){
    let poiArray = _.map(roomLayout["sources"], i => i.pos);
    if(roomLayout["controller"]){poiArray.push(roomLayout.controller.pos)}
    // the array is given different orders on different turns. this sorta stabilizes the results
    poiArray = poiArray.sort(gridSort);
    if(!roomLayout["pointsOfInterest"] || roomLayout["pointsOfInterest"].length !== poiArray.length){
        console.log("New points of interest detected in " + roomLayout.name + ", discarding existing layout");
        roomLayout["pointsOfInterest"] = poiArray;
        return true;
    }
    return false;
}
function createBoundingCircle(roomLayout, discardExisting){
    if(!roomLayout["boundingCircle"] || discardExisting){
        roomLayout["boundingCircle"] = boundingCircleMaker.makeCircle(roomLayout["pointsOfInterest"]);
    }
}
function createSourceToControllerPaths(roomLayout, discardExisting){
    if(!roomLayout.sources || !roomLayout.controller){return;}
    if(discardExisting && matrixIsCached(roomLayout)){discardMatrix(roomLayout);}
    for(let sourcePosName in roomLayout.sources){
        let source = roomLayout.sources[sourcePosName];
        let controller = roomLayout.controller;
        createSourceToControllerPath(source, controller, discardExisting);
    }
}
function createSourceToControllerPath(sourceRecord, controllerRecord, discardExisting){
    if(sourceRecord["pathToController"] && !discardExisting){return;}
    let sourcePos = new RoomPosition(sourceRecord.pos.x, sourceRecord.pos.y, sourceRecord.pos.roomName);
    let controllerPos = new RoomPosition(controllerRecord.pos.x, controllerRecord.pos.y, controllerRecord.pos.roomName);
    console.log("getting path for ", sourceRecord.id, " in ", sourceRecord.pos.roomName);
    sourceRecord["pathToController"] = PathFinder.search(
        sourcePos,
        {"pos": controllerPos, "range": 3},
        {"roomCallback": getLayoutCostMatrix, "plainCost": 20, "swampCost": 21, "maxRooms": 1});
    if (sourceRecord["pathToController"].path.length < 2){
        sourceRecord["pathToController"] = PathFinder.search(sourcePos,{"pos": controllerPos, "range": 1},{"plainCost": 20, "swampCost": 21, "maxRooms": 1});
        if (sourceRecord["pathToController"].path.length > 2){
            sourceRecord["pathToController"].path = sourceRecord["pathToController"].path.slice(0,2);
        }
    }
    if (sourceRecord["pathToController"].path.length > 0) {
        sourceRecord["harvestSpot"] = sourceRecord["pathToController"].path.shift();
    }
    if (sourceRecord["pathToController"].path.length > 0) {
        sourceRecord["upgradeSpot"] = sourceRecord["pathToController"].path.pop();
    }
    if (sourceRecord["pathToController"].path.length > 0) {
        sourceRecord["energyDropoffSpot"] = sourceRecord["pathToController"].path[sourceRecord["pathToController"].path.length-1];
    }
    if (sourceRecord["pathToController"].path.length > 0) {
        sourceRecord["energyPickupSpot"] = sourceRecord["pathToController"].path[0];
    }
    console.log("path created from " + sourcePos + " to " + controllerPos);
}
function getLayoutCostMatrix(roomName){
    let roomLayout = getRoomLayout(roomName);
    let costs;
    if(matrixIsCached(roomLayout)){
        costs = PathFinder.CostMatrix.deserialize(roomLayout.costs.matrix);
    }
    else{
        console.log("Generating cost matrix for " + roomName);
        costs =  generateCostMatrix(roomLayout);
        console.log("Finished generating cost matrix for " + roomName)
    }
    return costs;
}
function printCostMatrix(costs, roomName){
    let visual = new RoomVisual(roomName);
    for (let x of _.range(50)) {
        for (let y of _.range(50)) {
            visual.text(costs.get(x,y), x, y, {"font": 0.4});
        }
    }
}
function matrixIsCached(roomLayout){
    return roomLayout["costs"] && roomLayout.costs["matrix"];
}
function discardMatrix(roomLayout){
    if (roomLayout["costs"]){
        console.log("deleting costMatrix for " + roomLayout.name);
        delete roomLayout["costs"]
    }
}
function generateCostMatrix(roomLayout){
    // TODO upgradeSpots adjustment
    let center = roomLayout.boundingCircle;
    let resourcePositions = values(roomLayout["sources"]).map((r) => r.pos);
    let controllerPosition;
    console.log("generating cost matrix for " + roomLayout.name);

    const DISTANCE_MODIFIER = 2.5;
    let walls = [];
    let costs = new PathFinder.CostMatrix();
    for (let x of _.range(50)){
        for (let y of _.range(50)){
            let terrain = Game.map.getTerrainAt(x, y, roomLayout.name);
            if (terrain === "wall"){
                walls.push({"x":x,"y":y});
                costs.set(x,y,IMPASSIBLE);
                continue;
            }
            let terrainCost = terrain === "plain" ? 10 : 30;
            let distance = DISTANCE_MODIFIER * getDistance(x, y, center.x, center.y);
            costs.set(x,y,distance + terrainCost);
        }
    }
    costs = adjustWorkSpots(costs, resourcePositions);
    costs = adjustUpgradeSpots(costs, controllerPosition);
    costs = adjustNearWallSpots(costs, walls);
    cacheCostMatrix(costs, roomLayout);
    return costs;
}
function getDistance(x1,y1,x2,y2){
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}
function adjustWorkSpots(costs, resourcePositions){
    console.log("adjusting Work Spots");
    const WORK_PENALTY = 60;
    return adjustCostsNearTargetList(costs, resourcePositions, WORK_PENALTY, getNearSpots)
}
function adjustUpgradeSpots(costs, controllerPosition){
    const UPGRADE_PENALTY = 60;
    console.log("adjusting Upgrade Spots");
    return costs;
}
function adjustNearWallSpots(costs, walls){
    const WALL_PENALTY = 3;
    return adjustCostsNearTargetList(costs, walls, WALL_PENALTY, getAdjacentPositions)
}
function adjustCostsNearTargetList(costs, targetSpots, increase, nearSpotGenerator, range = 1) {
    let nearTargetSpots = [];
    for (let targetSpot of targetSpots) {
        for (let position of nearSpotGenerator(targetSpot, range)) {
            nearTargetSpots.push(position);
        }
    }
    nearTargetSpots.sort(gridSort);
    let lastSpot = {"x": 0, "y": 0};
    for (let nearSpot of nearTargetSpots) {
        if (positionsAreEqual(nearSpot, lastSpot)) {
            lastSpot = nearSpot;
            continue;
        }
        let cost = costs.get(nearSpot.x, nearSpot.y);
        if (cost < 255) {
            costs.set(nearSpot.x, nearSpot.y, cost + increase);
        }
        lastSpot = nearSpot;
    }
    return costs;
}
function getNearSpots(pos){
    let deltas = [
        {x: 0, y: -1},
        {x: 1, y: -1},
        {x: 1, y: 0},
        {x: 1, y: 1},
        {x: 0, y: 1},
        {x: -1, y: 1},
        {x: -1, y: 0},
        {x: -1, y: -1}
    ];
    return _.map(deltas, d => ({"x": pos.x + d.x, "y": pos.y + d.y, "roomName": pos.roomName}));
}
function getAdjacentPositions(pos) {
    let deltas = [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    return _.map(deltas, d => ({"x": pos.x + d.x, "y": pos.y + d.y}));
}
function gridSort(a, b){
    if (a.x === b.x){
        if (a.y === b.y){ return 0;}
        return a.y < b.y ? -1: 1;
    }
    return a.x < b.x ? -1: 1;
}
function cacheCostMatrix(costs, roomLayout){
    roomLayout["costs"] = {"matrix": costs.serialize()}
}

function createRCL1Structures(roomLayout, discardExisting){
    if (!isExpansionCandidate(roomLayout)){return;}
    createSpawn(roomLayout, discardExisting);
    createSpawnToSourcePaths(roomLayout);
}
function isExpansionCandidate(roomLayout){
    return roomLayout["expansionRoom"]
}
function createSpawn(roomLayout, discardExisting){
    if(!roomLayout.sources || !roomLayout.controller){return;}
    if (!roomLayout["spawns"] || discardExisting){roomLayout["spawns"] = {}}

    if (values(roomLayout["spawns"]).length > 0 && !discardExisting){return;}
    console.log(values(roomLayout["spawns"]).length > 0, " && ",!discardExisting);
    // first spawn only so far
    let sources = values(roomLayout.sources);
    console.log("creating Spawn in " + roomLayout.name);
    let closerSource = sources.length < 2 ? sources[0] :sources.reduce(getCloserThingByControllerPath);
    console.log("found closerSource to Spawn in " + roomLayout.name);
    let otherSpot = closerSource.energyPickupSpot ? closerSource.energyPickupSpot : closerSource.upgradeSpot;
    let candidatePos = getPosNear(closerSource.harvestSpot, otherSpot);
    console.log("starting out, spawn candidates are: " + JSON.stringify(candidatePos));
    candidatePos = removeWallPos(candidatePos);
    console.log("after removing walls, spawn candidates are: " + JSON.stringify(candidatePos));
    if (candidatePos.length === 1){
        createSpawnRecord(candidatePos[0]);
        return
    }
    candidatePos = removeControllerPaths(candidatePos, roomLayout);
    console.log("after removing paths, spawn candidates are: " + JSON.stringify(candidatePos));
    if (candidatePos.length > 0){
        createSpawnRecord(candidatePos[0]);
    }
}
function getCloserThingByControllerPath(a,b){
    return a.pathToController.path.length > b.pathToController.path.length ? b : a
}
function getPosNear(){
    let positions = values(arguments);
    let roomName = positions[0].roomName;
    let minX = positions.reduce((x,b) => x < b.x ? x : b.x, positions[0].x);
    let maxX = positions.reduce((x,b) => x > b.x ? x : b.x, positions[0].x);
    let minY = positions.reduce((y,b) => y < b.y ? y : b.y, positions[0].y);
    let maxY = positions.reduce((y,b) => y > b.y ? y : b.y, positions[0].y);
    if (maxX - minX > 2 || maxY - minY > 2){return false;}
    let validX = [];
    if(minX === maxX){validX = [minX-1, minX, minX + 1];}
    if(minX + 1 === maxX){validX = [minX, maxX];}
    if(minX + 2 === maxX){validX = [minX +1 ];}
    let validY = [];
    if(minY === maxY){validY = [minY-1, minY, minY + 1];}
    if(minY + 1 === maxY){validY = [minY, maxY];}
    if(minY + 2 === maxY){validY = [minY +1 ];}

    let validPositions = [];
    for (let x of validX){
        for (let y of validY){
            validPositions.push({"x": x, "y": y, "roomName": roomName})
        }
    }

    console.log("initial validPositions are:", JSON.stringify(validPositions), "attempting to remove", JSON.stringify(positions))
    validPositions = removeBadPositionsFromPositionList(positions, validPositions);
    return validPositions

}
function removeBadPositionsFromPositionList(badPositions,positionsList){
    return minusPositionList(positionsList, badPositions);
}
function minusPositionList(sourceList, removalList){
    return sourceList.filter(a => !removalList.find((b) => positionsAreEqual(a,b)));
}
function removeWallPos(positionList){
    return positionList.filter((p) => !isWall(p))
}
function isWall(pos){
    return Game.map.getTerrainAt(pos.x, pos.y, pos.roomName) === 'wall';
}
function createSpawnRecord(pos){
    let roomLayout = getRoomLayout(pos.roomName);
    if (!roomLayout["spawns"]){roomLayout["spawns"] = {};}
    let posName = getNameFrom(pos);
    if (!roomLayout.spawns[posName]){
        roomLayout.spawns[posName] = {"pos": pos};
    }
}
function removeControllerPaths(candidatePos, roomLayout){
    for (let source of values(roomLayout.sources)){
        candidatePos = minusPositionList(candidatePos,source.pathToController.path);
    }
    return candidatePos;
}
function createSpawnToSourcePaths(roomLayout){
    let spawnRecords = values(roomLayout.spawns);
    let spawnPos = spawnRecords[0].pos;
    for (let sourcePosName in roomLayout.sources){
        let goalPos = roomLayout.sources[sourcePosName].harvestSpot;
        roomLayout.sources[sourcePosName]["pathFromSpawn"] = createSpawnToSourcePath(roomLayout, spawnPos, goalPos);
    }
}
function createSpawnToSourcePath(roomLayout, spawnPos, goalPos){
    return PathFinder.search(
        spawnPos,
        {"pos": goalPos, "range": 0},
        {"roomCallback": getLayoutCostMatrix, "plainCost": 20, "swampCost": 21, "maxRooms": 1});
}

function drawLayouts(){
    for(let roomName in Memory.roomLayouts){
        drawLayoutIn(roomName);
    }
}
//drawLayouts = profiler.registerFN(drawLayouts, 'drawLayouts');
function drawLayoutIn(roomName){
    drawBoundingCircle(roomName);
    drawSourceToControllerPaths(roomName);
    drawSpawns(roomName);
}
function drawBoundingCircle(roomName){
    let boundingCircle = getRoomLayout(roomName)["boundingCircle"];
    if (!boundingCircle){console.log("Missing expected boundingCircle in " + roomName);return;}
    new RoomVisual(roomName).circle(boundingCircle.x, boundingCircle.y, {
        radius: boundingCircle.r,
        opacity: 1,
        stroke: '#33aaff',
        fill: null
    });
}
//drawBoundingCircle = profiler.registerFN(drawBoundingCircle, 'drawBoundingCircle');
function drawSourceToControllerPaths(roomName){
    let layout = getRoomLayout(roomName);
    let sourceRecords = layout["sources"];
    if(!sourceRecords || !layout.controller){return;}
    for(let sourceRecord of values(sourceRecords)){
        drawSourceToControllerPath(roomName, sourceRecord);
    }
}
//drawSourceToControllerPaths = profiler.registerFN(drawSourceToControllerPaths, 'drawSourceToControllerPaths');
function drawSourceToControllerPath(roomName, sourceRecord){
    if (!sourceRecord["pathToController"] && sourceRecord.pathToController.path){return;}
    let energyPathVisualStyle = {"opacity": 0.2, "stroke": "#808000", "strokeWidth": 0.5, "lineStyle": "dashed"};
    let harvestSpotVisualStyle = {"opacity": 1, "stroke": "#808000", "radius": .4, "fill": "#0000bb"};
    let energyPickupSpotVisualStyle = {"opacity": 1, "stroke": "#808000", "radius": .4, "fill": "#00bb00"};
    let energyDropoffSpotVisualStyle = {"opacity": 1, "stroke": "#808000", "radius": .4, "fill": "#f0f000"};
    let upgradeSpotVisualStyle = {"opacity": 1, "stroke": "#808000", "radius": .4, "fill": "#ff0000"};
    if (sourceRecord.pathToController.path.length > 0) {
        new RoomVisual(roomName).poly(sourceRecord.pathToController.path, energyPathVisualStyle);
    }
    if (sourceRecord.harvestSpot) {
        new RoomVisual(roomName).circle(sourceRecord.harvestSpot, harvestSpotVisualStyle);
    }
    if (sourceRecord.upgradeSpot) {
        new RoomVisual(roomName).circle(sourceRecord.upgradeSpot, upgradeSpotVisualStyle);
    }
    if (sourceRecord.energyPickupSpot) {
        new RoomVisual(roomName).circle(sourceRecord.energyPickupSpot, energyPickupSpotVisualStyle);
    }
    if (sourceRecord.energyDropoffSpot) {
        new RoomVisual(roomName).circle(sourceRecord.energyDropoffSpot, energyDropoffSpotVisualStyle);
    }

}
function drawSpawns(roomName){
    let roomLayout = getRoomLayout(roomName);
    if (!roomLayout["spawns"]){return;}
    for(let spawn of values(roomLayout["spawns"])){
        drawSpawn(spawn.pos)
    }
}
//drawSpawns = profiler.registerFN(drawSpawns, 'drawSpawns');
function drawSpawn(pos){
    let SpawnVisualStyle = {
        opacity: .25,
        stroke: '#000000',
        fill: '#ffff00',
        radius: .75
    };
    new RoomVisual(pos.roomName).circle(pos.x, pos.y, SpawnVisualStyle);
}




function getSourceRecord(pos){
    let roomLayout = getRoomLayout(pos.roomName);
    let posName = getNameFrom(pos);
    return roomLayout && roomLayout.sources && roomLayout.sources[posName] ? roomLayout.sources[posName]: undefined;
}

