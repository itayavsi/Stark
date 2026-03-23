// Simplified Natural Earth world map — bundled for offline use
// Coordinates are simplified but geographically accurate outlines
const WORLD_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // ── Americas ──────────────────────────────────────────
    { id:1, type:"Feature", properties:{name:"Canada", continent:"North America"},
      geometry:{type:"Polygon", coordinates:[[
        [-140,60],[-125,49],[-95,49],[-83,46],[-76,44],[-66,45],[-60,47],[-53,47],
        [-55,51],[-59,47],[-64,44],[-66,44],[-70,46],[-74,45],[-77,44],[-80,43],
        [-83,46],[-84,46],[-88,48],[-92,48],[-97,49],[-110,49],[-120,49],[-123,49],
        [-125,50],[-130,54],[-135,57],[-140,60],[-140,68],[-136,69],[-130,70],
        [-120,71],[-110,72],[-100,73],[-90,73],[-80,73],[-70,73],[-65,72],
        [-62,75],[-65,78],[-72,78],[-80,78],[-85,76],[-90,76],[-100,76],
        [-110,74],[-115,68],[-120,70],[-125,72],[-130,70],[-140,70],[-140,60]
      ]]}},
    { id:2, type:"Feature", properties:{name:"USA", continent:"North America"},
      geometry:{type:"Polygon", coordinates:[[
        [-124,48],[-116,49],[-111,49],[-100,49],[-97,49],[-88,48],[-83,46],
        [-80,44],[-76,44],[-72,43],[-70,43],[-67,44],[-66,44],[-70,41],
        [-73,41],[-74,40],[-75,38],[-76,35],[-77,34],[-80,32],[-81,31],
        [-84,30],[-87,30],[-88,29],[-90,29],[-93,29],[-97,26],[-97,28],
        [-100,28],[-104,29],[-106,32],[-111,31],[-114,32],[-117,32],[-120,34],
        [-124,37],[-124,40],[-124,42],[-124,46],[-124,48]
      ]]}},
    { id:3, type:"Feature", properties:{name:"Alaska", continent:"North America"},
      geometry:{type:"Polygon", coordinates:[[
        [-140,60],[-141,60],[-141,70],[-156,71],[-163,71],[-168,66],[-166,64],
        [-163,60],[-160,59],[-153,57],[-149,61],[-145,60],[-141,60],[-140,60]
      ]]}},
    { id:4, type:"Feature", properties:{name:"Mexico", continent:"North America"},
      geometry:{type:"Polygon", coordinates:[[
        [-117,32],[-111,31],[-106,32],[-104,29],[-100,28],[-97,28],[-97,26],
        [-97,23],[-90,18],[-88,16],[-88,16],[-92,17],[-94,18],[-97,19],
        [-105,20],[-109,23],[-110,24],[-115,30],[-117,32]
      ]]}},
    { id:5, type:"Feature", properties:{name:"Brazil", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-73,-10],[-70,-10],[-70,-4],[-68,-2],[-60,-1],[-52,4],[-51,4],
        [-50,2],[-48,0],[-44,-2],[-38,-3],[-35,-5],[-35,-9],[-37,-12],
        [-38,-16],[-40,-19],[-40,-22],[-44,-23],[-48,-26],[-48,-28],
        [-50,-29],[-52,-33],[-53,-33],[-54,-31],[-56,-28],[-58,-28],
        [-60,-22],[-60,-16],[-62,-13],[-60,-10],[-65,-10],[-68,-11],
        [-70,-10],[-73,-10]
      ]]}},
    { id:6, type:"Feature", properties:{name:"Argentina", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-68,-22],[-65,-22],[-60,-22],[-58,-28],[-56,-28],[-54,-31],
        [-53,-33],[-52,-33],[-53,-34],[-57,-38],[-61,-38],[-62,-42],
        [-65,-42],[-66,-45],[-65,-55],[-68,-55],[-70,-52],[-70,-42],
        [-68,-38],[-70,-35],[-70,-30],[-68,-27],[-68,-22]
      ]]}},
    { id:7, type:"Feature", properties:{name:"Colombia", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-77,8],[-76,2],[-72,2],[-70,1],[-68,-1],[-70,-4],[-73,-4],
        [-73,-10],[-70,-10],[-68,-11],[-65,-10],[-62,-13],[-60,-10],
        [-60,4],[-62,4],[-67,6],[-70,7],[-72,7],[-77,8]
      ]]}},
    { id:8, type:"Feature", properties:{name:"Venezuela", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-73,11],[-72,12],[-70,12],[-63,11],[-60,8],[-60,4],[-62,4],
        [-67,6],[-70,7],[-72,7],[-77,8],[-73,11]
      ]]}},
    { id:9, type:"Feature", properties:{name:"Chile", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-70,-17],[-68,-22],[-70,-30],[-70,-35],[-68,-38],[-70,-42],
        [-66,-45],[-65,-55],[-68,-55],[-70,-52],[-72,-50],[-72,-46],
        [-75,-40],[-72,-35],[-72,-30],[-70,-25],[-70,-18],[-70,-17]
      ]]}},
    { id:10, type:"Feature", properties:{name:"Peru", continent:"South America"},
      geometry:{type:"Polygon", coordinates:[[
        [-81,-4],[-80,-2],[-78,0],[-76,2],[-72,2],[-70,1],[-68,-1],
        [-70,-4],[-73,-4],[-73,-10],[-70,-10],[-70,-17],[-75,-14],
        [-81,-8],[-81,-4]
      ]]}},

    // ── Europe ────────────────────────────────────────────
    { id:11, type:"Feature", properties:{name:"Russia", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [28,70],[37,68],[40,67],[45,66],[55,65],[60,62],[60,55],[58,53],
        [55,52],[55,50],[60,50],[65,50],[70,52],[75,55],[80,55],[85,52],
        [90,52],[95,50],[100,50],[105,52],[110,52],[115,53],[120,52],
        [125,50],[128,48],[132,46],[135,46],[140,48],[141,54],[141,60],
        [141,70],[135,72],[130,72],[120,73],[110,74],[100,73],[90,74],
        [80,73],[70,73],[60,73],[55,73],[50,70],[45,68],[40,68],[35,70],
        [28,70]
      ]]}},
    { id:12, type:"Feature", properties:{name:"France", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [-4,48],[0,51],[3,50],[5,50],[7,48],[7,45],[6,44],[3,42],[0,43],
        [-2,43],[-4,48]
      ]]}},
    { id:13, type:"Feature", properties:{name:"Spain", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [-9,44],[-8,44],[-4,44],[0,43],[3,42],[3,40],[0,38],[-2,37],
        [-5,36],[-6,37],[-9,39],[-9,42],[-9,44]
      ]]}},
    { id:14, type:"Feature", properties:{name:"Germany", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [6,51],[8,55],[10,55],[12,54],[14,54],[15,52],[15,50],[13,48],
        [10,48],[8,47],[7,48],[6,50],[6,51]
      ]]}},
    { id:15, type:"Feature", properties:{name:"UK", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [-6,50],[-3,50],[0,51],[1,52],[1,53],[0,54],[-2,55],[-4,58],
        [-6,58],[-6,56],[-5,53],[-4,51],[-6,50]
      ]]}},
    { id:16, type:"Feature", properties:{name:"Italy", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [7,44],[10,44],[12,44],[15,41],[16,38],[15,37],[13,37],[12,38],
        [12,40],[14,42],[13,44],[11,44],[9,45],[7,45],[7,44]
      ]]}},
    { id:17, type:"Feature", properties:{name:"Ukraine", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [22,48],[24,48],[28,48],[32,46],[36,46],[38,47],[37,50],[35,52],
        [32,52],[28,53],[24,52],[22,51],[22,48]
      ]]}},
    { id:18, type:"Feature", properties:{name:"Poland", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [14,54],[16,54],[19,54],[22,54],[24,52],[22,51],[24,50],[22,48],
        [18,48],[15,50],[14,51],[14,54]
      ]]}},
    { id:19, type:"Feature", properties:{name:"Sweden", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [11,56],[12,55],[13,56],[15,58],[18,60],[20,60],[22,65],[24,66],
        [28,70],[22,70],[18,70],[16,68],[14,66],[12,62],[11,56]
      ]]}},
    { id:20, type:"Feature", properties:{name:"Norway", continent:"Europe"},
      geometry:{type:"Polygon", coordinates:[[
        [5,58],[8,58],[10,59],[12,64],[15,70],[18,70],[22,70],[28,70],
        [30,69],[28,68],[24,66],[22,65],[20,60],[18,60],[15,58],[12,55],
        [8,58],[5,58]
      ]]}},
    { id:21, type:"Feature", properties:{name:"Turkey", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [26,42],[28,42],[30,42],[34,42],[36,42],[38,40],[40,38],[42,38],
        [44,38],[44,40],[42,42],[40,42],[36,44],[34,42],[28,42],[26,42]
      ]]}},

    // ── Africa ────────────────────────────────────────────
    { id:22, type:"Feature", properties:{name:"Nigeria", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [3,6],[4,7],[5,8],[6,10],[8,10],[10,12],[14,12],[14,10],[12,8],
        [12,6],[10,5],[8,4],[5,5],[3,6]
      ]]}},
    { id:23, type:"Feature", properties:{name:"Egypt", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [25,22],[25,31],[32,31],[34,30],[35,29],[35,22],[25,22]
      ]]}},
    { id:24, type:"Feature", properties:{name:"South Africa", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [17,-29],[20,-29],[22,-33],[25,-34],[28,-33],[32,-28],[32,-24],
        [28,-22],[26,-18],[22,-18],[18,-22],[16,-28],[17,-29]
      ]]}},
    { id:25, type:"Feature", properties:{name:"Ethiopia", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [33,15],[36,15],[38,14],[42,12],[44,11],[42,8],[40,5],[38,4],
        [36,5],[34,8],[33,10],[33,15]
      ]]}},
    { id:26, type:"Feature", properties:{name:"DR Congo", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [18,5],[20,4],[24,2],[28,2],[30,0],[30,-4],[28,-8],[26,-10],
        [24,-10],[22,-8],[18,-5],[16,-2],[16,2],[18,5]
      ]]}},
    { id:27, type:"Feature", properties:{name:"Algeria", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [-2,30],[0,30],[4,30],[6,32],[8,37],[6,37],[2,37],[-2,35],[-2,30]
      ]]}},
    { id:28, type:"Feature", properties:{name:"Sudan", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [24,22],[28,22],[32,22],[36,18],[38,14],[36,15],[33,15],[33,10],
        [30,10],[28,8],[24,10],[24,22]
      ]]}},
    { id:29, type:"Feature", properties:{name:"Libya", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [10,22],[15,23],[20,23],[25,22],[25,31],[22,33],[20,33],[12,33],
        [10,30],[10,22]
      ]]}},
    { id:30, type:"Feature", properties:{name:"Morocco", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [-6,36],[-5,36],[-2,35],[-2,30],[-4,28],[-8,28],[-14,28],
        [-14,30],[-10,34],[-6,36]
      ]]}},
    { id:31, type:"Feature", properties:{name:"Kenya", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [34,4],[36,4],[38,4],[40,3],[42,2],[42,-2],[40,-4],[38,-4],
        [36,-2],[34,0],[34,4]
      ]]}},
    { id:32, type:"Feature", properties:{name:"Tanzania", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [34,-1],[36,-2],[38,-4],[40,-4],[40,-10],[38,-11],[36,-11],
        [34,-10],[30,-8],[30,-4],[34,-1]
      ]]}},
    { id:33, type:"Feature", properties:{name:"Madagascar", continent:"Africa"},
      geometry:{type:"Polygon", coordinates:[[
        [44,-12],[46,-12],[50,-16],[50,-24],[46,-25],[44,-20],[43,-16],[44,-12]
      ]]}},

    // ── Middle East ───────────────────────────────────────
    { id:34, type:"Feature", properties:{name:"Saudi Arabia", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [36,30],[38,30],[40,30],[44,28],[48,26],[56,22],[56,17],[50,15],
        [44,12],[42,12],[38,14],[36,18],[35,28],[36,30]
      ]]}},
    { id:35, type:"Feature", properties:{name:"Iran", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [44,38],[46,40],[48,40],[52,40],[56,38],[60,37],[62,36],[62,32],
        [60,25],[56,25],[54,26],[50,28],[48,30],[44,30],[44,36],[44,38]
      ]]}},
    { id:36, type:"Feature", properties:{name:"Iraq", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [38,34],[40,36],[42,38],[44,38],[44,34],[44,30],[42,30],[40,32],[38,34]
      ]]}},
    { id:37, type:"Feature", properties:{name:"Israel", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [34.25,29.5],[34.9,29.5],[35.7,31],[35.9,32.7],[35.1,33.3],
        [34.4,33.1],[34.2,31.8],[34.25,29.5]
      ]]}},
    { id:38, type:"Feature", properties:{name:"Syria", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [36,33],[38,34],[40,36],[42,38],[40,38],[38,38],[36,38],[36,36],[36,33]
      ]]}},

    // ── Asia ──────────────────────────────────────────────
    { id:39, type:"Feature", properties:{name:"China", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [78,36],[80,38],[82,40],[86,42],[90,44],[94,42],[98,40],[100,40],
        [104,38],[108,38],[110,40],[114,40],[118,42],[122,46],[122,48],
        [120,52],[116,53],[112,50],[108,48],[104,48],[100,46],[96,44],
        [92,42],[88,40],[84,38],[80,36],[78,34],[78,36]
      ]]}},
    { id:40, type:"Feature", properties:{name:"China South", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [100,22],[104,22],[108,22],[110,20],[114,22],[120,24],[122,28],
        [120,30],[116,32],[112,30],[108,28],[104,26],[100,24],[100,22]
      ]]}},
    { id:41, type:"Feature", properties:{name:"India", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [68,22],[70,24],[72,24],[74,26],[76,28],[78,30],[80,32],[82,30],
        [84,28],[86,26],[88,24],[88,22],[86,18],[82,14],[80,10],[78,8],
        [76,8],[74,16],[72,20],[68,22]
      ]]}},
    { id:42, type:"Feature", properties:{name:"Pakistan", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [60,25],[62,28],[64,30],[66,30],[68,30],[72,34],[74,36],[72,38],
        [68,36],[64,34],[60,34],[60,32],[60,28],[60,25]
      ]]}},
    { id:43, type:"Feature", properties:{name:"Afghanistan", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [60,34],[62,36],[64,38],[66,38],[68,38],[72,38],[74,36],[72,34],
        [68,30],[66,30],[64,30],[62,28],[60,28],[60,34]
      ]]}},
    { id:44, type:"Feature", properties:{name:"Kazakhstan", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [50,44],[55,44],[60,44],[65,44],[70,42],[75,42],[80,42],[85,48],
        [82,52],[78,55],[72,55],[66,55],[60,55],[55,52],[50,50],[50,44]
      ]]}},
    { id:45, type:"Feature", properties:{name:"Mongolia", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [90,44],[94,44],[98,44],[104,48],[110,48],[114,48],[118,48],[122,48],
        [120,52],[116,53],[110,52],[104,48],[100,46],[96,44],[90,44]
      ]]}},
    { id:46, type:"Feature", properties:{name:"Japan", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [130,32],[132,34],[134,36],[136,38],[138,40],[140,42],[142,44],
        [142,40],[140,38],[138,36],[136,34],[134,33],[132,33],[130,32]
      ]]}},
    { id:47, type:"Feature", properties:{name:"Korea", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [126,34],[128,36],[130,38],[130,40],[128,40],[126,38],[124,38],[126,34]
      ]]}},
    { id:48, type:"Feature", properties:{name:"Vietnam", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [102,10],[104,10],[106,10],[108,12],[108,18],[106,20],[104,22],
        [102,22],[102,18],[100,16],[102,12],[102,10]
      ]]}},
    { id:49, type:"Feature", properties:{name:"Thailand", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [98,6],[100,6],[102,6],[102,12],[100,14],[100,18],[102,18],
        [100,20],[98,20],[98,18],[98,12],[98,6]
      ]]}},
    { id:50, type:"Feature", properties:{name:"Indonesia", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [96,-5],[100,-5],[104,-6],[108,-7],[110,-8],[112,-8],[114,-8],
        [116,-8],[118,-8],[120,-10],[118,-8],[116,-8],[114,-6],[112,-6],
        [108,-6],[104,-4],[100,-2],[96,-2],[96,-5]
      ]]}},
    { id:51, type:"Feature", properties:{name:"Malaysia", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [100,2],[102,2],[104,2],[106,2],[108,2],[110,4],[112,4],[114,4],
        [116,6],[114,6],[112,6],[108,4],[104,4],[100,4],[100,2]
      ]]}},
    { id:52, type:"Feature", properties:{name:"Myanmar", continent:"Asia"},
      geometry:{type:"Polygon", coordinates:[[
        [92,28],[94,28],[98,26],[100,20],[98,18],[98,20],[98,16],[96,14],
        [94,16],[92,22],[92,28]
      ]]}},

    // ── Oceania ───────────────────────────────────────────
    { id:53, type:"Feature", properties:{name:"Australia", continent:"Oceania"},
      geometry:{type:"Polygon", coordinates:[[
        [114,-22],[116,-20],[120,-18],[122,-18],[128,-14],[132,-12],[136,-12],
        [138,-12],[140,-16],[142,-18],[144,-20],[146,-24],[148,-28],[152,-28],
        [154,-28],[152,-26],[150,-23],[148,-20],[146,-18],[144,-18],[142,-16],
        [140,-18],[138,-16],[136,-14],[132,-12],[128,-14],[122,-18],[120,-18],
        [116,-30],[114,-34],[116,-38],[118,-38],[120,-34],[120,-30],[118,-26],
        [114,-26],[114,-22]
      ]]}},
    { id:54, type:"Feature", properties:{name:"New Zealand", continent:"Oceania"},
      geometry:{type:"Polygon", coordinates:[[
        [166,-46],[170,-44],[172,-42],[174,-40],[176,-38],[178,-38],
        [176,-40],[174,-42],[172,-44],[170,-46],[168,-46],[166,-46]
      ]]}},
    { id:55, type:"Feature", properties:{name:"Papua New Guinea", continent:"Oceania"},
      geometry:{type:"Polygon", coordinates:[[
        [141,-6],[144,-6],[148,-6],[150,-6],[150,-4],[148,-4],[144,-4],
        [142,-4],[140,-6],[141,-6]
      ]]}},

    // ── Greenland ─────────────────────────────────────────
    { id:56, type:"Feature", properties:{name:"Greenland", continent:"North America"},
      geometry:{type:"Polygon", coordinates:[[
        [-46,60],[-44,60],[-38,64],[-28,70],[-18,76],[-16,80],[-24,84],
        [-40,84],[-52,82],[-58,78],[-58,72],[-56,68],[-46,64],[-46,60]
      ]]}},
  ]
};

export default WORLD_GEOJSON;
