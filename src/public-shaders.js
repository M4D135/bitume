/* BITUME — peau, vêtements, animation et ombres des spectateurs en WGSL. */
(function (B) {
  'use strict';
  B.shadersPublic = {
    couleur: {
      uniforms: {"byteLength":2816,"fields":[{"name":"uVP","type":"mat4","offset":0,"count":1,"arrayStride":64,"matrixStride":16},{"name":"uTemps","type":"vec4","offset":64,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uSections","type":"vec4","offset":80,"count":48,"arrayStride":16,"matrixStride":0},{"name":"uSections2","type":"vec4","offset":848,"count":48,"arrayStride":16,"matrixStride":0},{"name":"uPdrMatriceOmbre","type":"mat4","offset":1616,"count":1,"arrayStride":64,"matrixStride":16},{"name":"uPdrOmbreReglages","type":"vec4","offset":1680,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrOeil","type":"vec3","offset":1696,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrSoleil","type":"vec3","offset":1712,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrCouleurSoleil","type":"vec3","offset":1728,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrAmbiance","type":"vec3","offset":1744,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrBrouillard","type":"vec3","offset":1760,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrCielHaut","type":"vec3","offset":1776,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrCielBas","type":"vec3","offset":1792,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrEnvironnement","type":"vec4","offset":1808,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrResolution","type":"vec2","offset":1824,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumierePosition","type":"vec3","offset":1840,"count":12,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumiereCouleur","type":"vec3","offset":2032,"count":12,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumierePortee","type":"float","offset":2224,"count":12,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumiereDirection","type":"vec3","offset":2416,"count":12,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumiereCone","type":"vec2","offset":2608,"count":12,"arrayStride":16,"matrixStride":0},{"name":"uPdrLumieres","type":"int","offset":2800,"count":1,"arrayStride":16,"matrixStride":0}]},
      textures: [{"name":"uPublicF","binding":1,"samplerBinding":2,"dimension":"2d","depth":false,"sampleType":"unfilterable-float","samplerType":"non-filtering","sourceType":"sampler2D","renderTarget":false},{"name":"uPublicU","binding":3,"samplerBinding":4,"dimension":"2d","depth":false,"sampleType":"uint","samplerType":"non-filtering","sourceType":"usampler2D","renderTarget":false},{"name":"uPdrOmbre","binding":5,"samplerBinding":6,"dimension":"2d","depth":true,"sampleType":"depth","samplerType":"non-filtering","sourceType":"sampler2D","renderTarget":true}],
      entryPoint: "main",
      vertex: `diagnostic(off, derivative_uniformity);
struct FerroUniforms {
    data: array<vec4<f32>, 176>,
}

struct Pose {
    hanche: vec2<f32>,
    genou: vec2<f32>,
    cheville: vec2<f32>,
    ecart: vec2<f32>,
    ouvre: vec2<f32>,
    epaule: vec2<f32>,
    abduction: vec2<f32>,
    dedans: vec2<f32>,
    coude: vec2<f32>,
    balancier: vec2<f32>,
    torse: vec3<f32>,
    tete: vec2<f32>,
    souffle: f32,
}

struct VertexOutput {
    @location(0) vMonde: vec3<f32>,
    @location(1) vNormale: vec3<f32>,
    @location(2) vObjet: vec3<f32>,
    @location(3) @interpolate(flat) vBase: vec3<f32>,
    @location(4) @interpolate(flat) vSecond: vec3<f32>,
    @location(5) @interpolate(flat) vMatiere: vec4<f32>,
    @location(6) @interpolate(flat) vTrame: vec2<f32>,
    @location(7) @interpolate(flat) vMotif: u32,
    @builtin(position) gl_Position: vec4<f32>,
}

const PIV_HANCHES: vec3<f32> = vec3<f32>(0f, 0.95f, 0f);
const PIV_COU: vec3<f32> = vec3<f32>(0f, 1.52f, 0f);

@group(0) @binding(0)
var<uniform> ferroUniforms: FerroUniforms;
@group(0) @binding(1)
var uPublicF_texture: texture_2d<f32>;
@group(0) @binding(2)
var uPublicF_sampler: sampler;
@group(0) @binding(3)
var uPublicU_texture: texture_2d<u32>;
@group(0) @binding(4)
var uPublicU_sampler: sampler;
@group(0) @binding(5)
var uPdrOmbre_texture: texture_depth_2d;
@group(0) @binding(6)
var uPdrOmbre_sampler: sampler;
var<private> aPosition_1: vec3<f32>;
var<private> aNormale_1: vec3<f32>;
var<private> aPoids_1: vec2<f32>;
var<private> aInfo_1: vec4<u32>;
var<private> aSpectateur_1: u32;
var<private> vMonde: vec3<f32>;
var<private> vNormale: vec3<f32>;
var<private> vObjet: vec3<f32>;
var<private> vBase: vec3<f32>;
var<private> vSecond: vec3<f32>;
var<private> vMatiere: vec4<f32>;
var<private> vTrame: vec2<f32>;
var<private> vMotif: u32;
var<private> gl_Position: vec4<f32>;

fn ferro_uSections(index: i32) -> vec4<f32> {
    var index_1: i32;

    index_1 = index;
    let _e6: i32 = index_1;
    let _e12: vec4<f32> = ferroUniforms.data[(5i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uSections2_(index_2: i32) -> vec4<f32> {
    var index_3: i32;

    index_3 = index_2;
    let _e6: i32 = index_3;
    let _e12: vec4<f32> = ferroUniforms.data[(53i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uPdrLumierePosition(index_4: i32) -> vec3<f32> {
    var index_5: i32;

    index_5 = index_4;
    let _e6: i32 = index_5;
    let _e12: vec4<f32> = ferroUniforms.data[(115i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumiereCouleur(index_6: i32) -> vec3<f32> {
    var index_7: i32;

    index_7 = index_6;
    let _e6: i32 = index_7;
    let _e12: vec4<f32> = ferroUniforms.data[(127i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumierePortee(index_8: i32) -> f32 {
    var index_9: i32;

    index_9 = index_8;
    let _e6: i32 = index_9;
    let _e12: vec4<f32> = ferroUniforms.data[(139i + (_e6 * 1i))];
    return _e12.x;
}

fn ferro_uPdrLumiereDirection(index_10: i32) -> vec3<f32> {
    var index_11: i32;

    index_11 = index_10;
    let _e6: i32 = index_11;
    let _e12: vec4<f32> = ferroUniforms.data[(151i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumiereCone(index_12: i32) -> vec2<f32> {
    var index_13: i32;

    index_13 = index_12;
    let _e6: i32 = index_13;
    let _e12: vec4<f32> = ferroUniforms.data[(163i + (_e6 * 1i))];
    return _e12.xy;
}

fn rx(v: vec3<f32>, a: f32) -> vec3<f32> {
    var v_1: vec3<f32>;
    var a_1: f32;
    var c: f32;
    var s: f32;

    v_1 = v;
    a_1 = a;
    let _e28: f32 = a_1;
    c = cos(_e28);
    let _e31: f32 = a_1;
    s = sin(_e31);
    let _e34: vec3<f32> = v_1;
    let _e36: vec3<f32> = v_1;
    let _e38: f32 = c;
    let _e40: vec3<f32> = v_1;
    let _e42: f32 = s;
    let _e45: vec3<f32> = v_1;
    let _e48: f32 = s;
    let _e50: vec3<f32> = v_1;
    let _e52: f32 = c;
    return vec3<f32>(_e34.x, ((_e36.y * _e38) + (_e40.z * _e42)), ((-(_e45.y) * _e48) + (_e50.z * _e52)));
}

fn ry(v_2: vec3<f32>, a_2: f32) -> vec3<f32> {
    var v_3: vec3<f32>;
    var a_3: f32;
    var c_1: f32;
    var s_1: f32;

    v_3 = v_2;
    a_3 = a_2;
    let _e28: f32 = a_3;
    c_1 = cos(_e28);
    let _e31: f32 = a_3;
    s_1 = sin(_e31);
    let _e34: vec3<f32> = v_3;
    let _e36: f32 = c_1;
    let _e38: vec3<f32> = v_3;
    let _e40: f32 = s_1;
    let _e43: vec3<f32> = v_3;
    let _e45: vec3<f32> = v_3;
    let _e48: f32 = s_1;
    let _e50: vec3<f32> = v_3;
    let _e52: f32 = c_1;
    return vec3<f32>(((_e34.x * _e36) + (_e38.z * _e40)), _e43.y, ((-(_e45.x) * _e48) + (_e50.z * _e52)));
}

fn rz(v_4: vec3<f32>, a_4: f32) -> vec3<f32> {
    var v_5: vec3<f32>;
    var a_5: f32;
    var c_2: f32;
    var s_2: f32;

    v_5 = v_4;
    a_5 = a_4;
    let _e28: f32 = a_5;
    c_2 = cos(_e28);
    let _e31: f32 = a_5;
    s_2 = sin(_e31);
    let _e34: vec3<f32> = v_5;
    let _e36: f32 = c_2;
    let _e38: vec3<f32> = v_5;
    let _e40: f32 = s_2;
    let _e43: vec3<f32> = v_5;
    let _e45: f32 = s_2;
    let _e47: vec3<f32> = v_5;
    let _e49: f32 = c_2;
    let _e52: vec3<f32> = v_5;
    return vec3<f32>(((_e34.x * _e36) - (_e38.y * _e40)), ((_e43.x * _e45) + (_e47.y * _e49)), _e52.z);
}

fn couleur(c_3: u32) -> vec3<f32> {
    var c_4: u32;

    c_4 = c_3;
    let _e26: u32 = c_4;
    let _e33: u32 = c_4;
    let _e40: u32 = c_4;
    return (vec3<f32>(f32(((_e26 >> 16u) & 255u)), f32(((_e33 >> 8u) & 255u)), f32((_e40 & 255u))) / vec3(255f));
}

fn poserOs(p: ptr<function, vec3<f32>>, n: ptr<function, vec3<f32>>, os: u32, q: Pose) {
    var os_1: u32;
    var q_1: Pose;
    var local: i32;
    var c_5: i32;
    var local_1: f32;
    var sx: f32;
    var k: vec3<f32>;
    var k_1: vec3<f32>;
    var k_2: vec3<f32>;
    var local_2: i32;
    var c_6: i32;
    var local_3: f32;
    var sx_1: f32;
    var k_3: vec3<f32>;
    var k_4: vec3<f32>;
    var d: f32;
    var ab: f32;
    var w: f32;

    os_1 = os;
    q_1 = q;
    let _e30: u32 = os_1;
    let _e33: u32 = os_1;
    let _e37: u32 = os_1;
    let _e41: u32 = os_1;
    let _e45: u32 = os_1;
    if (((((_e30 == 4u) || (_e33 == 5u)) || (_e37 == 16u)) || (_e41 == 17u)) || (_e45 >= 20u)) {
        {
            let _e49: u32 = os_1;
            let _e52: u32 = os_1;
            let _e56: u32 = os_1;
            if (((_e49 == 4u) || (_e52 == 16u)) || (_e56 == 20u)) {
                local = 0i;
            } else {
                local = 1i;
            }
            let _e63: i32 = local;
            c_5 = _e63;
            let _e65: i32 = c_5;
            if (_e65 == 0i) {
                local_1 = -0.105f;
            } else {
                local_1 = 0.105f;
            }
            let _e72: f32 = local_1;
            sx = _e72;
            let _e74: u32 = os_1;
            if (_e74 >= 20u) {
                {
                    let _e77: f32 = sx;
                    k = vec3<f32>(_e77, 0.145f, 0f);
                    let _e82: vec3<f32> = k;
                    let _e83: vec3<f32> = (*p);
                    let _e84: vec3<f32> = k;
                    let _e86: i32 = c_5;
                    let _e89: f32 = q_1.cheville[_e86];
                    let _e90: vec3<f32> = rx((_e83 - _e84), _e89);
                    (*p) = (_e82 + _e90);
                    let _e92: vec3<f32> = (*n);
                    let _e93: i32 = c_5;
                    let _e96: f32 = q_1.cheville[_e93];
                    let _e97: vec3<f32> = rx(_e92, _e96);
                    (*n) = _e97;
                }
            }
            let _e98: u32 = os_1;
            if (_e98 >= 16u) {
                {
                    let _e101: f32 = sx;
                    k_1 = vec3<f32>(_e101, 0.52f, 0f);
                    let _e106: vec3<f32> = k_1;
                    let _e107: vec3<f32> = (*p);
                    let _e108: vec3<f32> = k_1;
                    let _e110: i32 = c_5;
                    let _e113: f32 = q_1.genou[_e110];
                    let _e114: vec3<f32> = rx((_e107 - _e108), _e113);
                    (*p) = (_e106 + _e114);
                    let _e116: vec3<f32> = (*n);
                    let _e117: i32 = c_5;
                    let _e120: f32 = q_1.genou[_e117];
                    let _e121: vec3<f32> = rx(_e116, _e120);
                    (*n) = _e121;
                }
            }
            let _e122: f32 = sx;
            k_2 = vec3<f32>(_e122, 0.97f, 0f);
            let _e127: vec3<f32> = k_2;
            let _e128: vec3<f32> = (*p);
            let _e129: vec3<f32> = k_2;
            let _e131: i32 = c_5;
            let _e134: f32 = q_1.hanche[_e131];
            let _e135: vec3<f32> = rx((_e128 - _e129), _e134);
            let _e136: i32 = c_5;
            let _e139: f32 = q_1.ouvre[_e136];
            let _e140: vec3<f32> = ry(_e135, _e139);
            let _e141: i32 = c_5;
            let _e144: f32 = q_1.ecart[_e141];
            let _e145: vec3<f32> = rz(_e140, _e144);
            (*p) = (_e127 + _e145);
            let _e147: vec3<f32> = (*n);
            let _e148: i32 = c_5;
            let _e151: f32 = q_1.hanche[_e148];
            let _e152: vec3<f32> = rx(_e147, _e151);
            let _e153: i32 = c_5;
            let _e156: f32 = q_1.ouvre[_e153];
            let _e157: vec3<f32> = ry(_e152, _e156);
            let _e158: i32 = c_5;
            let _e161: f32 = q_1.ecart[_e158];
            let _e162: vec3<f32> = rz(_e157, _e161);
            (*n) = _e162;
            return;
        }
    }
    let _e163: u32 = os_1;
    let _e166: u32 = os_1;
    let _e170: u32 = os_1;
    let _e174: u32 = os_1;
    if ((((_e163 == 2u) || (_e166 == 3u)) || (_e170 == 18u)) || (_e174 == 19u)) {
        {
            let _e178: u32 = os_1;
            let _e181: u32 = os_1;
            if ((_e178 == 2u) || (_e181 == 18u)) {
                local_2 = 0i;
            } else {
                local_2 = 1i;
            }
            let _e188: i32 = local_2;
            c_6 = _e188;
            let _e190: i32 = c_6;
            if (_e190 == 0i) {
                local_3 = -1f;
            } else {
                local_3 = 1f;
            }
            let _e197: f32 = local_3;
            sx_1 = _e197;
            let _e199: u32 = os_1;
            if (_e199 >= 18u) {
                {
                    let _e202: f32 = sx_1;
                    k_3 = vec3<f32>((_e202 * 0.255f), 1.19f, 0f);
                    let _e209: vec3<f32> = k_3;
                    let _e210: vec3<f32> = (*p);
                    let _e211: vec3<f32> = k_3;
                    let _e213: i32 = c_6;
                    let _e216: f32 = q_1.coude[_e213];
                    let _e217: vec3<f32> = rx((_e210 - _e211), _e216);
                    let _e218: f32 = sx_1;
                    let _e219: i32 = c_6;
                    let _e222: f32 = q_1.balancier[_e219];
                    let _e224: vec3<f32> = rz(_e217, (_e218 * _e222));
                    (*p) = (_e209 + _e224);
                    let _e226: vec3<f32> = (*n);
                    let _e227: i32 = c_6;
                    let _e230: f32 = q_1.coude[_e227];
                    let _e231: vec3<f32> = rx(_e226, _e230);
                    let _e232: f32 = sx_1;
                    let _e233: i32 = c_6;
                    let _e236: f32 = q_1.balancier[_e233];
                    let _e238: vec3<f32> = rz(_e231, (_e232 * _e236));
                    (*n) = _e238;
                }
            }
            let _e239: f32 = sx_1;
            k_4 = vec3<f32>((_e239 * 0.235f), 1.43f, 0f);
            let _e246: f32 = sx_1;
            let _e248: i32 = c_6;
            let _e251: f32 = q_1.dedans[_e248];
            d = (-(_e246) * _e251);
            let _e254: f32 = sx_1;
            let _e255: i32 = c_6;
            let _e258: f32 = q_1.abduction[_e255];
            ab = (_e254 * _e258);
            let _e261: vec3<f32> = k_4;
            let _e262: vec3<f32> = (*p);
            let _e263: vec3<f32> = k_4;
            let _e265: f32 = d;
            let _e266: vec3<f32> = ry((_e262 - _e263), _e265);
            let _e267: i32 = c_6;
            let _e270: f32 = q_1.epaule[_e267];
            let _e271: vec3<f32> = rx(_e266, _e270);
            let _e272: f32 = ab;
            let _e273: vec3<f32> = rz(_e271, _e272);
            (*p) = (_e261 + _e273);
            let _e275: vec3<f32> = (*n);
            let _e276: f32 = d;
            let _e277: vec3<f32> = ry(_e275, _e276);
            let _e278: i32 = c_6;
            let _e281: f32 = q_1.epaule[_e278];
            let _e282: vec3<f32> = rx(_e277, _e281);
            let _e283: f32 = ab;
            let _e284: vec3<f32> = rz(_e282, _e283);
            (*n) = _e284;
            let _e286: vec3<f32> = (*p);
            let _e289: Pose = q_1;
            (*p).y = (_e286.y + (0.004f * _e289.souffle));
        }
    } else {
        let _e293: u32 = os_1;
        if (_e293 == 1u) {
            {
                let _e296: vec3<f32> = (*p);
                let _e298: Pose = q_1;
                let _e302: vec3<f32> = rx((_e296 - PIV_COU), -(_e298.tete.y));
                let _e303: Pose = q_1;
                let _e306: vec3<f32> = ry(_e302, _e303.tete.x);
                (*p) = (PIV_COU + _e306);
                let _e308: vec3<f32> = (*n);
                let _e309: Pose = q_1;
                let _e313: vec3<f32> = rx(_e308, -(_e309.tete.y));
                let _e314: Pose = q_1;
                let _e317: vec3<f32> = ry(_e313, _e314.tete.x);
                (*n) = _e317;
            }
        } else {
            {
                let _e320: vec3<f32> = (*p);
                let _e326: vec3<f32> = (*p);
                w = (smoothstep(1.06f, 1.2f, _e320.y) * (1f - smoothstep(1.4f, 1.48f, _e326.y)));
                let _e332: vec3<f32> = (*p);
                let _e334: vec3<f32> = (*p);
                let _e338: Pose = q_1;
                let _e341: f32 = w;
                let _e344: vec2<f32> = (_e334.xz * (1f + ((0.013f * _e338.souffle) * _e341)));
                (*p).x = _e344.x;
                (*p).z = _e344.y;
            }
        }
    }
    let _e349: vec3<f32> = (*p);
    let _e351: Pose = q_1;
    let _e355: vec3<f32> = rx((_e349 - PIV_HANCHES), -(_e351.torse.x));
    let _e356: Pose = q_1;
    let _e359: vec3<f32> = rz(_e355, _e356.torse.y);
    let _e360: Pose = q_1;
    let _e363: vec3<f32> = ry(_e359, _e360.torse.z);
    (*p) = (PIV_HANCHES + _e363);
    let _e365: vec3<f32> = (*n);
    let _e366: Pose = q_1;
    let _e370: vec3<f32> = rx(_e365, -(_e366.torse.x));
    let _e371: Pose = q_1;
    let _e374: vec3<f32> = rz(_e370, _e371.torse.y);
    let _e375: Pose = q_1;
    let _e378: vec3<f32> = ry(_e374, _e375.torse.z);
    (*n) = _e378;
    return;
}

fn cacher() {
    gl_Position = vec4<f32>(0f, 0f, 3f, 1f);
    vMonde = vec3(0f);
    vNormale = vec3<f32>(0f, 1f, 0f);
    vObjet = vec3(0f);
    vBase = vec3(0f);
    vSecond = vec3(0f);
    vMatiere = vec4(0f);
    vTrame = vec2(0f);
    vMotif = 0u;
    return;
}

fn ferro_main() {
    var idx: u32;
    var lo8_: u32;
    var hi8_: u32;
    var t0_: vec2<i32>;
    var t1_: vec2<i32>;
    var U0_: vec4<u32>;
    var os_2: u32;
    var teinte: u32;
    var partie: u32;
    var mat: u32;
    var g: u32;
    var masque: u32;
    var traits: u32;
    var section: u32;
    var assis: bool;
    var h1_: f32;
    var h2_: f32;
    var h3_: f32;
    var h4_: f32;
    var t: f32;
    var S: vec4<f32>;
    var S2_: vec4<f32>;
    var exc: f32;
    var seuil: f32;
    var local_4: f32;
    var lever: f32;
    var lev: f32;
    var agite: f32;
    var deuxBras: bool;
    var applaudit: bool;
    var abri: u32;
    var posture: u32;
    var couvert: f32;
    var local_5: f32;
    var parapluie: f32;
    var local_6: f32;
    var capuche: f32;
    var local_7: f32;
    var drapeau: f32;
    var ph: f32;
    var souffle: f32;
    var om: f32;
    var q_2: Pose;
    var hA: f32;
    var gA: f32;
    var ouvre: f32;
    var c_7: i32 = 0i;
    var local_8: f32;
    var sc: f32;
    var local_9: f32;
    var appui: f32;
    var R0_: vec4<f32>;
    var local_10: vec4<f32>;
    var local_11: vec4<f32>;
    var local_12: vec4<f32>;
    var local_13: vec4<f32>;
    var local_14: f32;
    var c_8: i32 = 0i;
    var r: vec4<f32>;
    var k_5: f32;
    var c_9: i32 = 0i;
    var c_10: i32 = 0i;
    var local_15: f32;
    var bras: f32;
    var k_6: f32;
    var k_7: f32;
    var local_16: f32;
    var local_17: f32;
    var local_18: f32;
    var penche: f32;
    var local_19: f32;
    var A: vec4<f32>;
    var Bf: vec4<f32>;
    var ancre: vec3<f32>;
    var cap: f32;
    var cc: f32;
    var sc_1: f32;
    var X: vec3<f32>;
    var Fv: vec3<f32>;
    var teteMonde: vec3<f32>;
    var d_1: vec3<f32>;
    var lx: f32;
    var lz: f32;
    var lacet: f32;
    var tangage: f32;
    var poids: f32;
    var oisif: f32;
    var local_20: f32;
    var saut: f32;
    var p_1: vec3<f32>;
    var n_1: vec3<f32>;
    var objet: vec3<f32>;
    var v_6: f32;
    var jaw: f32;
    var upper: f32;
    var k_8: f32;
    var k_9: vec3<f32> = vec3<f32>(0f, 1.53f, -0.07f);
    var a_6: f32;
    var e: f32;
    var u: f32;
    var main_1: vec3<f32> = vec3<f32>(0.262f, 0.905f, 0.02f);
    var mn: vec3<f32> = vec3<f32>(0f, 1f, 0f);
    var local_21: f32;
    var r_1: f32;
    var l: vec3<f32>;
    var pa: vec3<f32>;
    var na: vec3<f32>;
    var pb: vec3<f32>;
    var nb: vec3<f32>;
    var echelle: vec3<f32>;
    var pivot: vec3<f32>;
    var monde: vec3<f32>;
    var U1_: vec4<u32>;
    var peau: u32;
    var chev: u32;
    var chau: u32;
    var PEAUX: array<vec3<f32>, 8> = array<vec3<f32>, 8>(vec3<f32>(0.28f, 0.17f, 0.12f), vec3<f32>(0.37f, 0.23f, 0.16f), vec3<f32>(0.45f, 0.29f, 0.2f), vec3<f32>(0.51f, 0.34f, 0.23f), vec3<f32>(0.6f, 0.41f, 0.29f), vec3<f32>(0.66f, 0.46f, 0.32f), vec3<f32>(0.79f, 0.6f, 0.46f), vec3<f32>(0.87f, 0.7f, 0.57f));
    var CHEVEUX: array<vec3<f32>, 8> = array<vec3<f32>, 8>(vec3<f32>(0.035f, 0.03f, 0.026f), vec3<f32>(0.1f, 0.065f, 0.04f), vec3<f32>(0.22f, 0.14f, 0.08f), vec3<f32>(0.36f, 0.25f, 0.14f), vec3<f32>(0.62f, 0.5f, 0.29f), vec3<f32>(0.42f, 0.17f, 0.07f), vec3<f32>(0.42f, 0.41f, 0.39f), vec3<f32>(0.74f, 0.73f, 0.7f));
    var CHAUSSURES: array<vec3<f32>, 4> = array<vec3<f32>, 4>(vec3<f32>(0.05f, 0.05f, 0.055f), vec3<f32>(0.24f, 0.15f, 0.08f), vec3<f32>(0.8f, 0.79f, 0.76f), vec3<f32>(0.1f, 0.12f, 0.2f));
    var b: vec3<f32>;
    var motif: u32 = 0u;
    var couvreChef: bool;
    var local_22: u32;
    var local_23: u32;
    var local_24: u32;
    var local_25: f32;
    var local_26: f32;
    var local_27: f32;
    var local_28: f32;
    var local_29: f32;
    var local_30: f32;
    var local_31: f32;
    var local_32: f32;
    var local_33: f32;
    var rug: f32;
    var local_34: f32;
    var abrite: f32;
    var local_35: f32;
    var textile: f32;
    var local_36: f32;
    var local_37: f32;

    let _e25: u32 = aSpectateur_1;
    idx = (_e25 & 65535u);
    let _e29: u32 = aSpectateur_1;
    lo8_ = ((_e29 >> 16u) & 255u);
    let _e36: u32 = aSpectateur_1;
    hi8_ = (_e36 >> 24u);
    let _e41: u32 = idx;
    let _e47: u32 = idx;
    t0_ = vec2<i32>(i32(((_e41 * 2u) & 1023u)), i32(((_e47 * 2u) >> 10u)));
    let _e56: vec2<i32> = t0_;
    let _e60: vec2<i32> = t0_;
    t1_ = vec2<i32>((_e56.x + 1i), _e60.y);
    let _e64: u32 = hi8_;
    let _e65: u32 = lo8_;
    if (_e64 <= _e65) {
        {
            cacher();
            return;
        }
    }
    let _e67: vec2<i32> = t0_;
    let _e69: vec4<u32> = textureLoad(uPublicU_texture, _e67, 0i);
    U0_ = _e69;
    let _e71: vec4<u32> = aInfo_1;
    os_2 = _e71.x;
    let _e74: vec4<u32> = aInfo_1;
    teinte = _e74.y;
    let _e77: vec4<u32> = aInfo_1;
    partie = _e77.z;
    let _e80: vec4<u32> = aInfo_1;
    mat = (_e80.w & 31u);
    let _e85: vec4<u32> = U0_;
    g = _e85.x;
    let _e88: vec4<u32> = U0_;
    masque = _e88.y;
    let _e91: vec4<u32> = U0_;
    traits = _e91.z;
    let _e94: vec4<u32> = U0_;
    section = min((_e94.w & 255u), 47u);
    let _e101: u32 = traits;
    assis = ((_e101 & 3u) == 0u);
    let _e107: u32 = masque;
    let _e108: u32 = partie;
    if (((_e107 >> _e108) & 1u) == 0u) {
        {
            cacher();
            return;
        }
    }
    let _e114: u32 = g;
    h1_ = (f32((_e114 & 255u)) / 255f);
    let _e121: u32 = g;
    h2_ = (f32(((_e121 >> 8u) & 255u)) / 255f);
    let _e131: u32 = g;
    h3_ = (f32(((_e131 >> 16u) & 255u)) / 255f);
    let _e141: u32 = g;
    h4_ = (f32(((_e141 >> 24u) & 255u)) / 255f);
    let _e154: vec4<f32> = ferroUniforms.data[4];
    t = _e154.x;
    let _e158: u32 = section;
    let _e160: vec4<f32> = ferro_uSections(i32(_e158));
    S = _e160;
    let _e162: u32 = section;
    let _e164: vec4<f32> = ferro_uSections2_(i32(_e162));
    S2_ = _e164;
    let _e166: vec4<f32> = S;
    let _e168: vec4<f32> = S2_;
    let _e172: f32 = h2_;
    exc = clamp(max(_e166.w, (_e168.y * (0.55f + (0.5f * _e172)))), 0f, 1f);
    let _e183: f32 = h1_;
    seuil = (0.16f + (0.95f * _e183));
    let _e187: bool = assis;
    if _e187 {
        let _e188: f32 = seuil;
        let _e189: f32 = seuil;
        let _e192: f32 = exc;
        local_4 = smoothstep(_e188, (_e189 + 0.17f), _e192);
    } else {
        local_4 = 1f;
    }
    let _e196: f32 = local_4;
    lever = _e196;
    let _e198: f32 = lever;
    let _e199: f32 = lever;
    let _e203: f32 = lever;
    lev = ((_e198 * _e199) * (3f - (2f * _e203)));
    let _e208: f32 = seuil;
    let _e211: f32 = seuil;
    let _e214: f32 = exc;
    agite = smoothstep((_e208 + 0.04f), (_e211 + 0.28f), _e214);
    let _e217: u32 = traits;
    deuxBras = (((_e217 >> 15u) & 1u) == 1u);
    let _e226: u32 = traits;
    applaudit = (((_e226 >> 16u) & 1u) == 1u);
    let _e235: u32 = traits;
    abri = ((_e235 >> 22u) & 3u);
    let _e242: u32 = traits;
    posture = ((_e242 >> 28u) & 3u);
    let _e251: f32 = h3_;
    let _e256: f32 = h3_;
    let _e262: vec4<f32> = ferroUniforms.data[4];
    couvert = smoothstep((0.06f + (0.3f * _e251)), (0.2f + (0.3f * _e256)), _e262.y);
    let _e267: u32 = abri;
    if (_e267 == 1u) {
        let _e270: f32 = couvert;
        local_5 = _e270;
    } else {
        local_5 = 0f;
    }
    let _e273: f32 = local_5;
    parapluie = _e273;
    let _e275: u32 = abri;
    if (_e275 == 2u) {
        let _e278: f32 = couvert;
        local_6 = _e278;
    } else {
        local_6 = 0f;
    }
    let _e281: f32 = local_6;
    capuche = _e281;
    let _e283: u32 = masque;
    if (((_e283 >> 11u) & 1u) == 1u) {
        let _e292: f32 = agite;
        local_7 = smoothstep(0.05f, 0.3f, _e292);
    } else {
        local_7 = 0f;
    }
    let _e296: f32 = local_7;
    drapeau = _e296;
    let _e298: u32 = partie;
    let _e301: f32 = parapluie;
    let _e305: u32 = partie;
    let _e308: f32 = drapeau;
    if (((_e298 == 10u) && (_e301 < 0.02f)) || ((_e305 == 11u) && (_e308 < 0.02f))) {
        {
            cacher();
            return;
        }
    }
    let _e314: f32 = h4_;
    ph = (6.2831855f * _e314);
    let _e317: f32 = t;
    let _e320: f32 = h3_;
    let _e324: f32 = ph;
    souffle = sin(((_e317 * (1.25f + (0.5f * _e320))) + _e324));
    let _e330: f32 = h2_;
    om = (9f + (5f * _e330));
    let _e336: f32 = souffle;
    q_2.souffle = _e336;
    let _e339: f32 = h3_;
    hA = (1.36f + (0.1f * (_e339 - 0.5f)));
    let _e345: f32 = hA;
    gA = -((_e345 + 0.04f));
    let _e352: f32 = h2_;
    ouvre = (0.06f + (0.12f * _e352));
    loop {
        let _e358: i32 = c_7;
        if !((_e358 < 2i)) {
            break;
        }
        {
            let _e365: i32 = c_7;
            if (_e365 == 0i) {
                local_8 = -1f;
            } else {
                local_8 = 1f;
            }
            let _e372: f32 = local_8;
            sc = _e372;
            let _e374: bool = assis;
            if _e374 {
                local_9 = 0f;
            } else {
                let _e378: f32 = t;
                let _e381: f32 = ph;
                let _e383: i32 = c_7;
                let _e392: f32 = agite;
                local_9 = ((0.06f * max(0f, sin((((_e378 * 0.31f) + _e381) + (f32(_e383) * 3.1f))))) * (1f - _e392));
            }
            let _e396: f32 = local_9;
            appui = _e396;
            let _e398: i32 = c_7;
            let _e401: f32 = hA;
            let _e403: f32 = lev;
            let _e405: f32 = appui;
            q_2.hanche[_e398] = (mix(_e401, 0f, _e403) + _e405);
            let _e407: i32 = c_7;
            let _e410: f32 = gA;
            let _e412: f32 = lev;
            let _e414: f32 = appui;
            q_2.genou[_e407] = (mix(_e410, 0f, _e412) - (_e414 * 2f));
            let _e418: i32 = c_7;
            let _e421: i32 = c_7;
            let _e424: f32 = q_2.hanche[_e421];
            let _e425: i32 = c_7;
            let _e428: f32 = q_2.genou[_e425];
            q_2.cheville[_e418] = -((_e424 + _e428));
            let _e431: i32 = c_7;
            let _e434: f32 = sc;
            let _e438: f32 = h1_;
            let _e441: f32 = lev;
            q_2.ecart[_e431] = (_e434 * mix(0.02f, (0.035f + (0.02f * _e438)), _e441));
            let _e444: i32 = c_7;
            let _e447: f32 = sc;
            let _e448: f32 = ouvre;
            let _e451: f32 = h3_;
            let _e454: f32 = lev;
            q_2.ouvre[_e444] = (_e447 * mix(_e448, (0.12f + (0.1f * _e451)), _e454));
        }
        continuing {
            let _e362: i32 = c_7;
            c_7 = (_e362 + 1i);
        }
    }
    let _e458: bool = assis;
    if _e458 {
        let _e459: u32 = posture;
        if (_e459 == 1u) {
            local_11 = vec4<f32>(0.3f, 0.1f, 0.5f, 1.25f);
        } else {
            let _e467: u32 = posture;
            if (_e467 == 2u) {
                local_10 = vec4<f32>(0.08f, 0.06f, 0.62f, 0.85f);
            } else {
                let _e477: f32 = h2_;
                let _e484: f32 = h3_;
                local_10 = vec4<f32>((0.2f + (0.06f * _e477)), 0.07f, 0.45f, (0.8f + (0.08f * _e484)));
            }
            let _e489: vec4<f32> = local_10;
            local_11 = _e489;
        }
        let _e491: vec4<f32> = local_11;
        R0_ = _e491;
    } else {
        let _e492: u32 = posture;
        if (_e492 == 1u) {
            local_13 = vec4<f32>(-0.05f, 0.16f, 0.25f, 0.35f);
        } else {
            let _e501: u32 = posture;
            if (_e501 == 2u) {
                local_12 = vec4<f32>(0.55f, 0.05f, 1.1f, 1.6f);
            } else {
                let _e511: f32 = h3_;
                let _e516: f32 = h2_;
                let _e522: f32 = h2_;
                local_12 = vec4<f32>((0.03f + (0.05f * _e511)), (0.06f + (0.04f * _e516)), 0.12f, (0.12f + (0.25f * _e522)));
            }
            let _e527: vec4<f32> = local_12;
            local_13 = _e527;
        }
        let _e529: vec4<f32> = local_13;
        R0_ = _e529;
    }
    let _e530: vec4<f32> = R0_;
    let _e536: bool = assis;
    if _e536 {
        let _e537: f32 = lev;
        local_14 = _e537;
    } else {
        local_14 = 0f;
    }
    let _e540: f32 = local_14;
    R0_ = mix(_e530, vec4<f32>(0.05f, 0.06f, 0.12f, 0.2f), vec4(_e540));
    loop {
        let _e545: i32 = c_8;
        if !((_e545 < 2i)) {
            break;
        }
        {
            let _e552: vec4<f32> = R0_;
            r = _e552;
            let _e554: bool = assis;
            let _e556: u32 = posture;
            let _e560: i32 = c_8;
            if ((!(_e554) && (_e556 == 2u)) && (_e560 == 0i)) {
                r = vec4<f32>(0.47f, 0.05f, 1.05f, 1.75f);
            }
            let _e569: i32 = c_8;
            let _e572: vec4<f32> = r;
            q_2.epaule[_e569] = _e572.x;
            let _e574: i32 = c_8;
            let _e577: vec4<f32> = r;
            q_2.abduction[_e574] = _e577.y;
            let _e579: i32 = c_8;
            let _e582: vec4<f32> = r;
            q_2.dedans[_e579] = _e582.z;
            let _e584: i32 = c_8;
            let _e587: vec4<f32> = r;
            q_2.coude[_e584] = _e587.w;
            let _e589: i32 = c_8;
            q_2.balancier[_e589] = 0f;
        }
        continuing {
            let _e549: i32 = c_8;
            c_8 = (_e549 + 1i);
        }
    }
    let _e593: bool = applaudit;
    if _e593 {
        {
            let _e596: f32 = t;
            let _e597: f32 = om;
            let _e601: f32 = ph;
            k_5 = (0.5f + (0.5f * sin((((_e596 * _e597) * 1.2f) + _e601))));
            loop {
                let _e609: i32 = c_9;
                if !((_e609 < 2i)) {
                    break;
                }
                {
                    let _e616: i32 = c_9;
                    let _e619: i32 = c_9;
                    let _e622: f32 = q_2.epaule[_e619];
                    let _e624: f32 = agite;
                    q_2.epaule[_e616] = mix(_e622, 1f, _e624);
                    let _e626: i32 = c_9;
                    let _e629: i32 = c_9;
                    let _e632: f32 = q_2.coude[_e629];
                    let _e634: f32 = agite;
                    q_2.coude[_e626] = mix(_e632, 1.2f, _e634);
                    let _e636: i32 = c_9;
                    let _e639: i32 = c_9;
                    let _e642: f32 = q_2.abduction[_e639];
                    let _e644: f32 = agite;
                    q_2.abduction[_e636] = mix(_e642, 0.02f, _e644);
                    let _e646: i32 = c_9;
                    let _e649: i32 = c_9;
                    let _e652: f32 = q_2.dedans[_e649];
                    let _e655: f32 = k_5;
                    let _e658: f32 = agite;
                    q_2.dedans[_e646] = mix(_e652, (0.72f + (0.32f * _e655)), _e658);
                }
                continuing {
                    let _e613: i32 = c_9;
                    c_9 = (_e613 + 1i);
                }
            }
        }
    } else {
        {
            loop {
                let _e662: i32 = c_10;
                if !((_e662 < 2i)) {
                    break;
                }
                {
                    let _e669: i32 = c_10;
                    let _e672: bool = deuxBras;
                    if ((_e669 == 1i) || _e672) {
                        let _e674: f32 = agite;
                        local_15 = _e674;
                    } else {
                        local_15 = 0f;
                    }
                    let _e677: f32 = local_15;
                    bras = _e677;
                    let _e679: f32 = t;
                    let _e680: f32 = om;
                    let _e684: f32 = ph;
                    let _e686: i32 = c_10;
                    k_6 = sin(((((_e679 * _e680) * 0.62f) + _e684) + (f32(_e686) * 1.7f)));
                    let _e693: i32 = c_10;
                    let _e696: i32 = c_10;
                    let _e699: f32 = q_2.epaule[_e696];
                    let _e702: f32 = t;
                    let _e705: f32 = ph;
                    let _e710: f32 = bras;
                    q_2.epaule[_e693] = mix(_e699, (2.55f + (0.12f * sin(((_e702 * 1.7f) + _e705)))), _e710);
                    let _e712: i32 = c_10;
                    let _e715: i32 = c_10;
                    let _e718: f32 = q_2.abduction[_e715];
                    let _e722: f32 = k_6;
                    let _e725: f32 = bras;
                    q_2.abduction[_e712] = mix(_e718, (-0.3f + (0.1f * _e722)), _e725);
                    let _e727: i32 = c_10;
                    let _e730: i32 = c_10;
                    let _e733: f32 = q_2.dedans[_e730];
                    let _e735: f32 = bras;
                    q_2.dedans[_e727] = mix(_e733, 0f, _e735);
                    let _e737: i32 = c_10;
                    let _e740: i32 = c_10;
                    let _e743: f32 = q_2.coude[_e740];
                    let _e746: f32 = t;
                    let _e747: f32 = om;
                    let _e751: f32 = ph;
                    let _e753: i32 = c_10;
                    let _e761: f32 = bras;
                    q_2.coude[_e737] = mix(_e743, (0.32f + (0.12f * sin((((((_e746 * _e747) * 0.62f) + _e751) + f32(_e753)) + 1f)))), _e761);
                    let _e763: i32 = c_10;
                    let _e767: f32 = k_6;
                    let _e769: f32 = bras;
                    q_2.balancier[_e763] = ((0.42f * _e767) * _e769);
                }
                continuing {
                    let _e666: i32 = c_10;
                    c_10 = (_e666 + 1i);
                }
            }
        }
    }
    let _e771: f32 = parapluie;
    if (_e771 > 0f) {
        {
            let _e780: f32 = q_2.epaule.y;
            let _e782: f32 = parapluie;
            q_2.epaule[1i] = mix(_e780, 0.62f, _e782);
            let _e790: f32 = q_2.coude.y;
            let _e792: f32 = parapluie;
            q_2.coude[1i] = mix(_e790, 1.82f, _e792);
            let _e800: f32 = q_2.abduction.y;
            let _e802: f32 = parapluie;
            q_2.abduction[1i] = mix(_e800, 0.1f, _e802);
            let _e810: f32 = q_2.dedans.y;
            let _e812: f32 = parapluie;
            q_2.dedans[1i] = mix(_e810, 0.2f, _e812);
            let _e820: f32 = q_2.balancier.y;
            let _e822: f32 = parapluie;
            q_2.balancier[1i] = (_e820 * (1f - _e822));
        }
    }
    let _e825: f32 = drapeau;
    if (_e825 > 0f) {
        {
            let _e828: f32 = t;
            let _e831: f32 = ph;
            k_7 = sin(((_e828 * 7f) + _e831));
            let _e841: f32 = q_2.epaule.x;
            let _e844: f32 = k_7;
            let _e847: f32 = drapeau;
            q_2.epaule[0i] = mix(_e841, (2.55f + (0.2f * _e844)), _e847);
            let _e855: f32 = q_2.abduction.x;
            let _e859: f32 = k_7;
            let _e862: f32 = drapeau;
            q_2.abduction[0i] = mix(_e855, (-0.25f + (0.3f * _e859)), _e862);
            let _e870: f32 = q_2.dedans.x;
            let _e872: f32 = drapeau;
            q_2.dedans[0i] = mix(_e870, 0f, _e872);
            let _e880: f32 = q_2.coude.x;
            let _e882: f32 = drapeau;
            q_2.coude[0i] = mix(_e880, 0.25f, _e882);
            q_2.balancier[0i] = 0f;
        }
    }
    let _e888: bool = assis;
    if _e888 {
        let _e889: u32 = posture;
        if (_e889 == 1u) {
            local_17 = 0.34f;
        } else {
            let _e893: u32 = posture;
            if (_e893 == 2u) {
                local_16 = -0.1f;
            } else {
                let _e900: f32 = h1_;
                local_16 = (0.02f + (0.05f * _e900));
            }
            let _e904: f32 = local_16;
            local_17 = _e904;
        }
        let _e906: f32 = local_17;
        local_18 = _e906;
    } else {
        local_18 = 0.02f;
    }
    let _e909: f32 = local_18;
    penche = _e909;
    let _e913: f32 = penche;
    let _e915: f32 = lev;
    let _e917: bool = assis;
    if _e917 {
        let _e920: f32 = lever;
        local_19 = (0.5f * sin((3.1415927f * _e920)));
    } else {
        local_19 = 0f;
    }
    let _e926: f32 = local_19;
    let _e929: f32 = souffle;
    let _e933: f32 = agite;
    let _e935: f32 = t;
    let _e936: f32 = om;
    let _e940: f32 = ph;
    q_2.torse.x = (((mix(_e913, 0.03f, _e915) + _e926) + (0.012f * _e929)) + ((0.06f * _e933) * sin((((_e935 * _e936) * 0.62f) + _e940))));
    let _e948: f32 = t;
    let _e951: f32 = ph;
    let _e956: f32 = agite;
    let _e958: f32 = t;
    let _e959: f32 = om;
    let _e963: f32 = ph;
    q_2.torse.y = ((0.022f * sin(((_e948 * 0.43f) + _e951))) + ((0.03f * _e956) * sin((((_e958 * _e959) * 0.31f) + _e963))));
    let _e968: vec2<i32> = t0_;
    let _e970: vec4<f32> = textureLoad(uPublicF_texture, _e968, 0i);
    A = _e970;
    let _e972: vec2<i32> = t1_;
    let _e974: vec4<f32> = textureLoad(uPublicF_texture, _e972, 0i);
    Bf = _e974;
    let _e976: vec4<f32> = A;
    ancre = _e976.xyz;
    let _e979: vec4<f32> = A;
    cap = _e979.w;
    let _e982: f32 = cap;
    cc = cos(_e982);
    let _e985: f32 = cap;
    sc_1 = sin(_e985);
    let _e988: f32 = cc;
    let _e990: f32 = sc_1;
    X = vec3<f32>(_e988, 0f, -(_e990));
    let _e994: f32 = sc_1;
    let _e996: f32 = cc;
    Fv = vec3<f32>(_e994, 0f, _e996);
    let _e999: vec3<f32> = ancre;
    let _e1003: vec4<f32> = Bf;
    let _e1006: f32 = lev;
    let _e1011: vec3<f32> = Fv;
    let _e1012: vec4<f32> = Bf;
    let _e1015: f32 = lev;
    teteMonde = ((_e999 + vec3<f32>(0f, mix(0.62f, (1.62f - _e1003.y), _e1006), 0f)) + ((_e1011 * _e1012.x) * _e1015));
    let _e1019: vec4<f32> = S;
    let _e1021: vec3<f32> = teteMonde;
    d_1 = (_e1019.xyz - _e1021);
    let _e1024: vec3<f32> = d_1;
    let _e1025: vec3<f32> = X;
    lx = dot(_e1024, _e1025);
    let _e1028: vec3<f32> = d_1;
    let _e1029: vec3<f32> = Fv;
    lz = dot(_e1028, _e1029);
    let _e1032: f32 = lx;
    let _e1033: f32 = lz;
    lacet = atan2(_e1032, _e1033);
    let _e1036: vec3<f32> = d_1;
    let _e1039: f32 = lx;
    let _e1040: f32 = lz;
    tangage = atan2(_e1036.y, max(0.5f, length(vec2<f32>(_e1039, _e1040))));
    let _e1046: vec4<f32> = S2_;
    let _e1050: f32 = h2_;
    let _e1057: f32 = lacet;
    poids = ((_e1046.x * (0.7f + (0.3f * _e1050))) * (1f - smoothstep(1.9f, 2.5f, abs(_e1057))));
    let _e1064: f32 = t;
    let _e1067: f32 = h2_;
    let _e1071: f32 = ph;
    let _e1078: f32 = t;
    let _e1081: f32 = h1_;
    oisif = ((0.38f * sin(((_e1064 * (0.09f + (0.06f * _e1067))) + (_e1071 * 1.3f)))) + (0.16f * sin(((_e1078 * 0.27f) + (_e1081 * 9f)))));
    let _e1089: f32 = oisif;
    let _e1090: f32 = lacet;
    let _e1095: f32 = poids;
    lacet = mix(_e1089, clamp(_e1090, -1.5f, 1.5f), _e1095);
    let _e1100: f32 = lacet;
    q_2.torse.z = (0.3f * _e1100);
    let _e1104: f32 = lacet;
    let _e1105: Pose = q_2;
    q_2.tete.x = clamp((_e1104 - _e1105.torse.z), -1.15f, 1.15f);
    let _e1117: f32 = t;
    let _e1120: f32 = ph;
    let _e1125: f32 = tangage;
    let _e1129: f32 = poids;
    let _e1136: f32 = agite;
    let _e1139: f32 = parapluie;
    q_2.tete.y = (clamp(mix((0.08f + (0.06f * sin(((_e1117 * 0.21f) + _e1120)))), (-(_e1125) * 0.8f), _e1129), -0.35f, 0.5f) - ((0.25f * _e1136) * (1f - _e1139)));
    let _e1143: u32 = traits;
    if (((_e1143 >> 17u) & 1u) == 1u) {
        let _e1153: f32 = t;
        let _e1154: f32 = om;
        let _e1158: f32 = ph;
        let _e1165: f32 = agite;
        local_20 = ((0.06f * max(0f, sin((((_e1153 * _e1154) * 0.7f) + _e1158)))) * smoothstep(0.5f, 0.9f, _e1165));
    } else {
        local_20 = 0f;
    }
    let _e1170: f32 = local_20;
    saut = _e1170;
    let _e1172: vec3<f32> = aPosition_1;
    p_1 = _e1172;
    let _e1174: vec3<f32> = aNormale_1;
    n_1 = _e1174;
    let _e1176: vec3<f32> = aPosition_1;
    objet = _e1176;
    let _e1178: u32 = os_2;
    let _e1181: vec3<f32> = p_1;
    if ((_e1178 == 1u) && (_e1181.y > 1.54f)) {
        {
            let _e1186: u32 = traits;
            v_6 = ((f32(((_e1186 >> 24u) & 15u)) / 7.5f) - 1f);
            let _e1198: vec3<f32> = p_1;
            jaw = exp(-(pow(((_e1198.y - 1.605f) / 0.052f), 2f)));
            let _e1209: vec3<f32> = p_1;
            upper = clamp(((_e1209.y - 1.54f) / 0.1f), 0f, 1f);
            let _e1220: vec3<f32> = p_1;
            let _e1223: f32 = v_6;
            let _e1226: f32 = jaw;
            let _e1230: f32 = upper;
            p_1.x = (_e1220.x * (1f + ((_e1223 * (0.025f + (0.035f * _e1226))) * _e1230)));
            let _e1235: vec3<f32> = p_1;
            let _e1237: f32 = v_6;
            let _e1240: vec3<f32> = p_1;
            let _e1246: vec3<f32> = p_1;
            let _e1259: vec3<f32> = p_1;
            p_1.z = (_e1235.z + (((_e1237 * 0.003f) * exp(-((pow((_e1240.x / 0.02f), 2f) + pow(((_e1246.y - 1.675f) / 0.035f), 2f))))) * max(0f, (_e1259.z / 0.1f))));
        }
    }
    let _e1266: u32 = traits;
    let _e1274: u32 = os_2;
    let _e1278: u32 = os_2;
    let _e1282: vec3<f32> = p_1;
    if ((((((_e1266 >> 10u) & 1u) == 1u) && (_e1274 <= 3u)) && (_e1278 != 1u)) && (_e1282.y > 1.2f)) {
        let _e1288: vec3<f32> = p_1;
        let _e1294: vec3<f32> = p_1;
        p_1.x = (_e1288.x * (1f - (0.025f * smoothstep(1.2f, 1.44f, _e1294.y))));
    }
    let _e1300: u32 = os_2;
    if (_e1300 == 1u) {
        {
            let _e1304: vec4<f32> = Bf;
            k_8 = pow(clamp((1f / _e1304.z), 1f, 1.4f), 0.6f);
            let _e1313: vec3<f32> = p_1;
            let _e1315: f32 = k_8;
            p_1 = (PIV_COU + ((_e1313 - PIV_COU) * _e1315));
        }
    }
    let _e1318: u32 = partie;
    let _e1321: u32 = traits;
    if ((_e1318 == 5u) && (((_e1321 >> 14u) & 1u) == 1u)) {
        {
            let _e1330: vec3<f32> = p_1;
            let _e1333: vec3<f32> = p_1;
            let _e1337: vec3<f32> = p_1;
            p_1 = vec3<f32>(-(_e1330.x), _e1333.y, (-0.008f - _e1337.z));
            let _e1341: vec3<f32> = n_1;
            let _e1344: vec3<f32> = n_1;
            let _e1346: vec3<f32> = n_1;
            n_1 = vec3<f32>(-(_e1341.x), _e1344.y, -(_e1346.z));
        }
    }
    let _e1350: u32 = partie;
    if (_e1350 == 9u) {
        {
            let _e1361: f32 = capuche;
            a_6 = (1.75f * (1f - _e1361));
            let _e1367: f32 = capuche;
            e = mix(0.5f, 1f, _e1367);
            let _e1370: vec3<f32> = k_9;
            let _e1371: vec3<f32> = p_1;
            let _e1372: vec3<f32> = k_9;
            let _e1375: f32 = e;
            let _e1376: f32 = e;
            let _e1379: f32 = a_6;
            let _e1380: vec3<f32> = rx(((_e1371 - _e1372) * vec3<f32>(1f, _e1375, _e1376)), _e1379);
            p_1 = (_e1370 + _e1380);
            let _e1382: vec3<f32> = n_1;
            let _e1385: f32 = e;
            let _e1388: f32 = e;
            let _e1393: f32 = a_6;
            let _e1394: vec3<f32> = rx(normalize((_e1382 * vec3<f32>(1f, (1f / _e1385), (1f / _e1388)))), _e1393);
            n_1 = _e1394;
        }
    }
    let _e1395: u32 = partie;
    if (_e1395 == 11u) {
        {
            let _e1398: vec2<f32> = aPoids_1;
            u = _e1398.y;
            let _e1402: vec3<f32> = p_1;
            let _e1405: f32 = u;
            let _e1407: f32 = t;
            let _e1410: f32 = u;
            let _e1414: f32 = ph;
            let _e1418: f32 = drapeau;
            p_1.z = (_e1402.z + (((0.07f * _e1405) * sin((((_e1407 * 11f) - (_e1410 * 7f)) + _e1414))) * _e1418));
            let _e1424: vec3<f32> = p_1;
            let _e1428: f32 = drapeau;
            p_1.x = (-0.26f + ((_e1424.x + 0.26f) * _e1428));
            let _e1433: vec3<f32> = p_1;
            let _e1437: f32 = drapeau;
            p_1.y = (0.905f + ((_e1433.y - 0.905f) * _e1437));
        }
    }
    let _e1440: u32 = partie;
    if (_e1440 == 10u) {
        {
            let _e1456: Pose = q_2;
            poserOs((&main_1), (&mn), 19u, _e1456);
            let _e1459: vec3<f32> = p_1;
            if (_e1459.y > 0.7f) {
                let _e1465: f32 = parapluie;
                local_21 = mix(0.08f, 1f, _e1465);
            } else {
                local_21 = 1f;
            }
            let _e1469: f32 = local_21;
            r_1 = _e1469;
            let _e1471: vec3<f32> = p_1;
            let _e1473: f32 = r_1;
            let _e1475: vec3<f32> = p_1;
            let _e1477: vec3<f32> = p_1;
            let _e1479: f32 = r_1;
            let _e1483: vec3<f32> = rx(vec3<f32>((_e1471.x * _e1473), _e1475.y, (_e1477.z * _e1479)), 0.22f);
            l = _e1483;
            let _e1485: vec3<f32> = n_1;
            let _e1487: vec3<f32> = rx(_e1485, 0.22f);
            n_1 = _e1487;
            let _e1488: vec3<f32> = main_1;
            let _e1489: vec3<f32> = l;
            p_1 = (_e1488 + _e1489);
        }
    } else {
        {
            let _e1491: vec3<f32> = p_1;
            pa = _e1491;
            let _e1493: vec3<f32> = n_1;
            na = _e1493;
            let _e1497: u32 = os_2;
            let _e1498: Pose = q_2;
            poserOs((&pa), (&na), _e1497, _e1498);
            let _e1501: vec4<u32> = aInfo_1;
            if ((_e1501.w & 32u) != 0u) {
                {
                    let _e1507: vec3<f32> = p_1;
                    pb = _e1507;
                    let _e1509: vec3<f32> = n_1;
                    nb = _e1509;
                    let _e1513: vec2<f32> = aPoids_1;
                    let _e1518: Pose = q_2;
                    poserOs((&pb), (&nb), u32((_e1513.x + 0.5f)), _e1518);
                    let _e1521: vec3<f32> = pa;
                    let _e1522: vec3<f32> = pb;
                    let _e1523: vec2<f32> = aPoids_1;
                    pa = mix(_e1521, _e1522, vec3(_e1523.y));
                    let _e1527: vec3<f32> = na;
                    let _e1528: vec3<f32> = nb;
                    let _e1529: vec2<f32> = aPoids_1;
                    na = mix(_e1527, _e1528, vec3(_e1529.y));
                }
            }
            let _e1533: vec3<f32> = pa;
            p_1 = _e1533;
            let _e1534: vec3<f32> = na;
            n_1 = _e1534;
        }
    }
    let _e1535: vec4<f32> = Bf;
    let _e1537: vec4<f32> = Bf;
    let _e1541: vec4<f32> = Bf;
    echelle = vec3<f32>(_e1535.w, _e1537.z, (0.5f + (0.5f * _e1541.w)));
    let _e1550: f32 = lev;
    pivot = vec3<f32>(0f, (0.97f * (1f - _e1550)), 0f);
    let _e1556: vec3<f32> = pivot;
    let _e1557: vec3<f32> = p_1;
    let _e1558: vec3<f32> = pivot;
    let _e1560: vec3<f32> = echelle;
    p_1 = (_e1556 + ((_e1557 - _e1558) * _e1560));
    let _e1563: vec3<f32> = n_1;
    let _e1564: vec3<f32> = echelle;
    n_1 = (_e1563 / _e1564);
    let _e1566: vec3<f32> = p_1;
    let _e1573: vec4<f32> = Bf;
    let _e1576: vec4<f32> = Bf;
    let _e1579: f32 = lev;
    p_1 = (_e1566 + mix(vec3<f32>(0f, -0.97f, 0f), vec3<f32>(0f, -(_e1573.y), _e1576.x), vec3(_e1579)));
    let _e1584: vec3<f32> = p_1;
    let _e1586: f32 = saut;
    p_1.y = (_e1584.y + _e1586);
    let _e1588: vec3<f32> = ancre;
    let _e1589: vec3<f32> = X;
    let _e1590: vec3<f32> = p_1;
    let _e1595: vec3<f32> = p_1;
    let _e1600: vec3<f32> = Fv;
    let _e1601: vec3<f32> = p_1;
    monde = (((_e1588 + (_e1589 * _e1590.x)) + vec3<f32>(0f, _e1595.y, 0f)) + (_e1600 * _e1601.z));
    let _e1609: vec4<f32> = ferroUniforms.data[0];
    let _e1615: vec4<f32> = ferroUniforms.data[1];
    let _e1621: vec4<f32> = ferroUniforms.data[2];
    let _e1627: vec4<f32> = ferroUniforms.data[3];
    let _e1649: vec3<f32> = monde;
    gl_Position = (mat4x4<f32>(vec4<f32>(_e1609.x, _e1609.y, _e1609.z, _e1609.w), vec4<f32>(_e1615.x, _e1615.y, _e1615.z, _e1615.w), vec4<f32>(_e1621.x, _e1621.y, _e1621.z, _e1621.w), vec4<f32>(_e1627.x, _e1627.y, _e1627.z, _e1627.w)) * vec4<f32>(_e1649.x, _e1649.y, _e1649.z, 1f));
    let _e1656: vec3<f32> = monde;
    vMonde = _e1656;
    let _e1657: vec3<f32> = X;
    let _e1658: vec3<f32> = n_1;
    let _e1662: vec3<f32> = n_1;
    let _e1667: vec3<f32> = Fv;
    let _e1668: vec3<f32> = n_1;
    vNormale = (((_e1657 * _e1658.x) + vec3<f32>(0f, _e1662.y, 0f)) + (_e1667 * _e1668.z));
    let _e1672: vec3<f32> = objet;
    vObjet = _e1672;
    let _e1673: u32 = lo8_;
    let _e1675: u32 = hi8_;
    vTrame = (vec2<f32>(f32(_e1673), f32(_e1675)) / vec2(255f));
    let _e1681: vec2<i32> = t1_;
    let _e1683: vec4<u32> = textureLoad(uPublicU_texture, _e1681, 0i);
    U1_ = _e1683;
    let _e1685: u32 = traits;
    peau = ((_e1685 >> 2u) & 7u);
    let _e1692: u32 = traits;
    chev = ((_e1692 >> 5u) & 7u);
    let _e1699: u32 = traits;
    chau = ((_e1699 >> 8u) & 3u);
    let _e1795: u32 = masque;
    couvreChef = (((_e1795 >> 5u) & 15u) != 0u);
    let _e1803: u32 = teinte;
    if (_e1803 == 10u) {
        let _e1806: f32 = capuche;
        if (_e1806 > 0.5f) {
            local_24 = 1u;
        } else {
            let _e1810: bool = couvreChef;
            if _e1810 {
                local_23 = 5u;
            } else {
                let _e1812: u32 = masque;
                if ((_e1812 & 32770u) != 0u) {
                    local_22 = 4u;
                } else {
                    local_22 = 0u;
                }
                let _e1820: u32 = local_22;
                local_23 = _e1820;
            }
            let _e1822: u32 = local_23;
            local_24 = _e1822;
        }
        let _e1824: u32 = local_24;
        teinte = _e1824;
    }
    let _e1825: u32 = teinte;
    let _e1828: u32 = traits;
    let _e1837: u32 = os_2;
    let _e1840: u32 = os_2;
    let _e1844: u32 = os_2;
    let _e1848: u32 = os_2;
    let _e1853: vec3<f32> = objet;
    if ((((_e1825 == 1u) && (((_e1828 >> 11u) & 1u) == 1u)) && ((((_e1837 == 2u) || (_e1840 == 3u)) || (_e1844 == 18u)) || (_e1848 == 19u))) && (_e1853.y < 1.255f)) {
        teinte = 0u;
    }
    let _e1859: u32 = teinte;
    let _e1862: u32 = traits;
    let _e1871: vec3<f32> = objet;
    let _e1876: u32 = os_2;
    if ((((_e1859 == 2u) && (((_e1862 >> 12u) & 1u) == 1u)) && (_e1871.y < 0.62f)) && (_e1876 != 0u)) {
        teinte = 0u;
    }
    let _e1881: u32 = teinte;
    let _e1884: u32 = traits;
    let _e1893: u32 = os_2;
    let _e1896: u32 = os_2;
    let _e1901: vec3<f32> = objet;
    if ((((_e1881 == 0u) && (((_e1884 >> 13u) & 1u) == 1u)) && ((_e1893 == 18u) || (_e1896 == 19u))) && (_e1901.y < 0.97f)) {
        teinte = 5u;
    }
    let _e1907: u32 = teinte;
    if (_e1907 == 0u) {
        let _e1910: u32 = peau;
        let _e1912: vec3<f32> = PEAUX[_e1910];
        b = _e1912;
    } else {
        let _e1913: u32 = teinte;
        if (_e1913 == 1u) {
            {
                let _e1916: vec4<u32> = U1_;
                let _e1918: vec3<f32> = couleur(_e1916.x);
                b = _e1918;
                let _e1919: u32 = partie;
                if (_e1919 == 0u) {
                    let _e1922: u32 = traits;
                    motif = ((_e1922 >> 18u) & 15u);
                }
            }
        } else {
            let _e1928: u32 = teinte;
            if (_e1928 == 2u) {
                let _e1931: vec4<u32> = U1_;
                let _e1933: vec3<f32> = couleur(_e1931.y);
                b = _e1933;
            } else {
                let _e1934: u32 = teinte;
                if (_e1934 == 3u) {
                    let _e1937: u32 = chau;
                    let _e1939: vec3<f32> = CHAUSSURES[_e1937];
                    b = _e1939;
                } else {
                    let _e1940: u32 = teinte;
                    if (_e1940 == 4u) {
                        let _e1943: u32 = chev;
                        let _e1945: vec3<f32> = CHEVEUX[_e1943];
                        b = _e1945;
                    } else {
                        let _e1946: u32 = teinte;
                        if (_e1946 == 5u) {
                            {
                                let _e1949: vec4<u32> = U1_;
                                let _e1951: vec3<f32> = couleur(_e1949.z);
                                b = _e1951;
                                let _e1952: u32 = partie;
                                let _e1955: f32 = h3_;
                                if ((_e1952 == 5u) && (_e1955 > 0.6f)) {
                                    motif = 10u;
                                }
                            }
                        } else {
                            let _e1960: u32 = teinte;
                            if (_e1960 == 6u) {
                                {
                                    let _e1963: vec4<u32> = U1_;
                                    let _e1965: vec3<f32> = couleur(_e1963.w);
                                    b = _e1965;
                                    let _e1966: u32 = partie;
                                    if (_e1966 == 10u) {
                                        motif = 8u;
                                    }
                                    let _e1970: u32 = partie;
                                    if (_e1970 == 11u) {
                                        motif = 9u;
                                    }
                                }
                            } else {
                                let _e1974: u32 = teinte;
                                if (_e1974 == 7u) {
                                    b = vec3<f32>(0.8f, 0.79f, 0.76f);
                                } else {
                                    let _e1981: u32 = teinte;
                                    if (_e1981 == 8u) {
                                        b = vec3<f32>(0.025f, 0.025f, 0.03f);
                                    } else {
                                        b = vec3<f32>(0.52f, 0.53f, 0.55f);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let _e1992: u32 = motif;
    vMotif = _e1992;
    let _e1993: vec3<f32> = b;
    vBase = _e1993;
    let _e1994: vec4<u32> = U0_;
    let _e1998: vec3<f32> = couleur((_e1994.w >> 8u));
    vSecond = _e1998;
    let _e1999: u32 = mat;
    if (_e1999 == 1u) {
        local_33 = 0.58f;
    } else {
        let _e2003: u32 = mat;
        if (_e2003 == 2u) {
            local_32 = 0.5f;
        } else {
            let _e2007: u32 = mat;
            if (_e2007 == 3u) {
                local_31 = 0.52f;
            } else {
                let _e2011: u32 = mat;
                if (_e2011 == 4u) {
                    local_30 = 0.42f;
                } else {
                    let _e2015: u32 = mat;
                    if (_e2015 == 5u) {
                        local_29 = 0.3f;
                    } else {
                        let _e2019: u32 = mat;
                        if (_e2019 == 7u) {
                            local_28 = 0.12f;
                        } else {
                            let _e2023: u32 = mat;
                            if (_e2023 == 8u) {
                                local_27 = 0.25f;
                            } else {
                                let _e2027: u32 = mat;
                                if (_e2027 == 6u) {
                                    local_26 = 0.82f;
                                } else {
                                    let _e2031: u32 = mat;
                                    if (_e2031 == 9u) {
                                        local_25 = 0.97f;
                                    } else {
                                        local_25 = 0.88f;
                                    }
                                    let _e2037: f32 = local_25;
                                    local_26 = _e2037;
                                }
                                let _e2039: f32 = local_26;
                                local_27 = _e2039;
                            }
                            let _e2041: f32 = local_27;
                            local_28 = _e2041;
                        }
                        let _e2043: f32 = local_28;
                        local_29 = _e2043;
                    }
                    let _e2045: f32 = local_29;
                    local_30 = _e2045;
                }
                let _e2047: f32 = local_30;
                local_31 = _e2047;
            }
            let _e2049: f32 = local_31;
            local_32 = _e2049;
        }
        let _e2051: f32 = local_32;
        local_33 = _e2051;
    }
    let _e2053: f32 = local_33;
    rug = _e2053;
    let _e2055: u32 = abri;
    if (_e2055 == 3u) {
        local_34 = 1f;
    } else {
        let _e2059: f32 = parapluie;
        let _e2060: f32 = capuche;
        local_34 = max(_e2059, _e2060);
    }
    let _e2063: f32 = local_34;
    abrite = _e2063;
    let _e2065: u32 = mat;
    let _e2068: u32 = mat;
    let _e2072: u32 = mat;
    if (((_e2065 == 0u) || (_e2068 == 9u)) || (_e2072 == 3u)) {
        local_35 = 1f;
    } else {
        local_35 = 0f;
    }
    let _e2079: f32 = local_35;
    textile = _e2079;
    let _e2081: f32 = rug;
    let _e2082: u32 = mat;
    if (_e2082 == 5u) {
        local_36 = 0.85f;
    } else {
        local_36 = 0f;
    }
    let _e2088: f32 = local_36;
    let _e2092: vec4<f32> = ferroUniforms.data[4];
    let _e2096: f32 = abrite;
    let _e2099: f32 = textile;
    let _e2101: u32 = teinte;
    let _e2104: u32 = os_2;
    if ((_e2101 == 0u) && (_e2104 == 1u)) {
        local_37 = 1f;
    } else {
        local_37 = 0f;
    }
    let _e2111: f32 = local_37;
    vMatiere = vec4<f32>(_e2081, _e2088, ((_e2092.z * (1f - _e2096)) * _e2099), _e2111);
    return;
}

fn main_2() {
    ferro_main();
    let _e26: vec4<f32> = gl_Position;
    let _e28: vec4<f32> = gl_Position;
    gl_Position.z = ((_e26.z + _e28.w) * 0.5f);
    return;
}

@vertex
fn main(@location(0) aPosition: vec3<f32>, @location(1) aNormale: vec3<f32>, @location(2) aPoids: vec2<f32>, @location(3) aInfo: vec4<u32>, @location(4) aSpectateur: u32) -> VertexOutput {
    aPosition_1 = aPosition;
    aNormale_1 = aNormale;
    aPoids_1 = aPoids;
    aInfo_1 = aInfo;
    aSpectateur_1 = aSpectateur;
    main_2();
    let _e56: vec3<f32> = vMonde;
    let _e58: vec3<f32> = vNormale;
    let _e60: vec3<f32> = vObjet;
    let _e62: vec3<f32> = vBase;
    let _e64: vec3<f32> = vSecond;
    let _e66: vec4<f32> = vMatiere;
    let _e68: vec2<f32> = vTrame;
    let _e70: u32 = vMotif;
    let _e72: vec4<f32> = gl_Position;
    return VertexOutput(_e56, _e58, _e60, _e62, _e64, _e66, _e68, _e70, _e72);
}
`,
      fragment: `diagnostic(off, derivative_uniformity);
struct FerroUniforms {
    data: array<vec4<f32>, 176>,
}

struct FragmentOutput {
    @location(0) fragColor: vec4<f32>,
}

@group(0) @binding(0)
var<uniform> ferroUniforms: FerroUniforms;
@group(0) @binding(1)
var uPublicF_texture: texture_2d<f32>;
@group(0) @binding(2)
var uPublicF_sampler: sampler;
@group(0) @binding(3)
var uPublicU_texture: texture_2d<u32>;
@group(0) @binding(4)
var uPublicU_sampler: sampler;
@group(0) @binding(5)
var uPdrOmbre_texture: texture_depth_2d;
@group(0) @binding(6)
var uPdrOmbre_sampler: sampler;
var<private> gl_FragCoord_1: vec4<f32>;
var<private> vMonde_1: vec3<f32>;
var<private> vNormale_1: vec3<f32>;
var<private> vObjet_1: vec3<f32>;
var<private> vBase_1: vec3<f32>;
var<private> vSecond_1: vec3<f32>;
var<private> vMatiere_1: vec4<f32>;
var<private> vTrame_1: vec2<f32>;
var<private> vMotif_1: u32;
var<private> fragColor: vec4<f32>;

fn ferro_uSections(index: i32) -> vec4<f32> {
    var index_1: i32;

    index_1 = index;
    let _e6: i32 = index_1;
    let _e12: vec4<f32> = ferroUniforms.data[(5i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uSections2_(index_2: i32) -> vec4<f32> {
    var index_3: i32;

    index_3 = index_2;
    let _e6: i32 = index_3;
    let _e12: vec4<f32> = ferroUniforms.data[(53i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uPdrLumierePosition(index_4: i32) -> vec3<f32> {
    var index_5: i32;

    index_5 = index_4;
    let _e6: i32 = index_5;
    let _e12: vec4<f32> = ferroUniforms.data[(115i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumiereCouleur(index_6: i32) -> vec3<f32> {
    var index_7: i32;

    index_7 = index_6;
    let _e6: i32 = index_7;
    let _e12: vec4<f32> = ferroUniforms.data[(127i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumierePortee(index_8: i32) -> f32 {
    var index_9: i32;

    index_9 = index_8;
    let _e6: i32 = index_9;
    let _e12: vec4<f32> = ferroUniforms.data[(139i + (_e6 * 1i))];
    return _e12.x;
}

fn ferro_uPdrLumiereDirection(index_10: i32) -> vec3<f32> {
    var index_11: i32;

    index_11 = index_10;
    let _e6: i32 = index_11;
    let _e12: vec4<f32> = ferroUniforms.data[(151i + (_e6 * 1i))];
    return _e12.xyz;
}

fn ferro_uPdrLumiereCone(index_12: i32) -> vec2<f32> {
    var index_13: i32;

    index_13 = index_12;
    let _e6: i32 = index_13;
    let _e12: vec4<f32> = ferroUniforms.data[(163i + (_e6 * 1i))];
    return _e12.xy;
}

fn pdrEchantillon(uv: vec2<f32>, decalage: vec2<f32>, profondeur: f32, pente: vec2<f32>) -> f32 {
    var uv_1: vec2<f32>;
    var decalage_1: vec2<f32>;
    var profondeur_1: f32;
    var pente_1: vec2<f32>;
    var texel: f32;
    var tap: vec2<f32>;
    var centre: vec2<f32>;

    uv_1 = uv;
    decalage_1 = decalage;
    profondeur_1 = profondeur;
    pente_1 = pente;
    let _e20: vec4<f32> = ferroUniforms.data[105];
    texel = _e20.y;
    let _e24: vec2<f32> = uv_1;
    let _e25: vec2<f32> = decalage_1;
    let _e26: f32 = texel;
    tap = (_e24 + (_e25 * _e26));
    let _e30: vec2<f32> = tap;
    let _e31: f32 = texel;
    let _e38: f32 = texel;
    centre = ((floor((_e30 / vec2(_e31))) + vec2(0.5f)) * _e38);
    let _e41: f32 = profondeur_1;
    let _e42: vec2<f32> = pente_1;
    let _e43: vec2<f32> = centre;
    let _e44: vec2<f32> = uv_1;
    let _e48: vec2<f32> = tap;
    let _e51: vec2<f32> = tap;
    let _e56: vec4<f32> = vec4<f32>(textureSampleLevel(uPdrOmbre_texture, uPdrOmbre_sampler, vec2<f32>(_e48.x, (1f - _e51.y)),0),0.0,0.0,1.0);
    return step((_e41 + dot(_e42, (_e43 - _e44))), _e56.x);
}

fn pdrOmbreSoleil(monde: vec3<f32>, n: vec3<f32>) -> f32 {
    var monde_1: vec3<f32>;
    var n_1: vec3<f32>;
    var projete: vec4<f32>;
    var p: vec3<f32>;
    var dx: vec3<f32>;
    var dy: vec3<f32>;
    var determinant_: f32;
    var local: vec2<f32>;
    var pente_2: vec2<f32>;
    var biais: f32;
    var z: f32;
    var local_1: vec2<f32>;
    var uv_2: vec2<f32>;
    var local_2: f32;
    var texel_1: f32;
    var cell: vec2<f32>;
    var f: vec2<f32>;
    var centre_1: vec2<f32>;
    var wx: vec3<f32>;
    var wy: vec3<f32>;
    var v: f32 = 0f;
    var y: i32 = 0i;
    var x: i32;
    var tap_1: vec2<f32>;
    var bord: f32;

    monde_1 = monde;
    n_1 = n;
    let _e16: vec4<f32> = ferroUniforms.data[105];
    if (_e16.x < 0.5f) {
        return 1f;
    }
    let _e25: vec4<f32> = ferroUniforms.data[101];
    let _e31: vec4<f32> = ferroUniforms.data[102];
    let _e37: vec4<f32> = ferroUniforms.data[103];
    let _e43: vec4<f32> = ferroUniforms.data[104];
    let _e65: vec3<f32> = monde_1;
    let _e66: vec3<f32> = n_1;
    let _e69: vec3<f32> = (_e65 + (_e66 * 0.014f));
    projete = (mat4x4<f32>(vec4<f32>(_e25.x, _e25.y, _e25.z, _e25.w), vec4<f32>(_e31.x, _e31.y, _e31.z, _e31.w), vec4<f32>(_e37.x, _e37.y, _e37.z, _e37.w), vec4<f32>(_e43.x, _e43.y, _e43.z, _e43.w)) * vec4<f32>(_e69.x, _e69.y, _e69.z, 1f));
    let _e77: vec4<f32> = projete;
    let _e79: vec4<f32> = projete;
    p = (((_e77.xyz / vec3(_e79.w)) * 0.5f) + vec3(0.5f));
    let _e89: vec3<f32> = p;
    let _e90: vec3<f32> = dpdx(_e89);
    dx = _e90;
    let _e92: vec3<f32> = p;
    let _e93: vec3<f32> = dpdy(_e92);
    dy = -(_e93);
    let _e96: vec3<f32> = dx;
    let _e98: vec3<f32> = dy;
    let _e101: vec3<f32> = dx;
    let _e103: vec3<f32> = dy;
    determinant_ = ((_e96.x * _e98.y) - (_e101.y * _e103.x));
    let _e108: f32 = determinant_;
    if (abs(_e108) > 0.00000000001f) {
        let _e112: vec3<f32> = dx;
        let _e114: vec3<f32> = dy;
        let _e117: vec3<f32> = dy;
        let _e119: vec3<f32> = dx;
        let _e123: vec3<f32> = dy;
        let _e125: vec3<f32> = dx;
        let _e128: vec3<f32> = dx;
        let _e130: vec3<f32> = dy;
        let _e135: f32 = determinant_;
        local = (vec2<f32>(((_e112.z * _e114.y) - (_e117.z * _e119.y)), ((_e123.z * _e125.x) - (_e128.z * _e130.x))) / vec2(_e135));
    } else {
        local = vec2(0f);
    }
    let _e141: vec2<f32> = local;
    pente_2 = _e141;
    let _e143: vec4<f32> = projete;
    let _e147: vec3<f32> = p;
    let _e152: vec3<f32> = p;
    let _e157: vec3<f32> = p;
    let _e159: vec3<f32> = p;
    let _e165: vec3<f32> = p;
    let _e167: vec3<f32> = p;
    if (((((_e143.w <= 0f) || (_e147.z <= 0f)) || (_e152.z >= 1f)) || (min(_e157.x, _e159.y) <= 0.001f)) || (max(_e165.x, _e167.y) >= 0.999f)) {
        return 1f;
    }
    let _e177: vec3<f32> = n_1;
    let _e181: vec4<f32> = ferroUniforms.data[107];
    biais = (0.00014f + (0.00024f * (1f - max(dot(_e177, _e181.xyz), 0f))));
    let _e190: vec3<f32> = p;
    let _e192: f32 = biais;
    z = (_e190.z - _e192);
    let _e198: vec4<f32> = ferroUniforms.data[105];
    if (_e198.z > 0.5f) {
        let _e203: vec3<f32> = p;
        local_1 = _e203.xy;
    } else {
        let _e205: vec3<f32> = p;
        local_1 = ((_e205.xy * 0.5f) + vec2<f32>(0.5f, 0f));
    }
    let _e214: vec2<f32> = local_1;
    uv_2 = _e214;
    let _e216: vec2<f32> = pente_2;
    let _e220: vec4<f32> = ferroUniforms.data[105];
    if (_e220.z > 0.5f) {
        local_2 = 1f;
    } else {
        local_2 = 2f;
    }
    let _e228: f32 = local_2;
    pente_2 = (_e216 * _e228);
    let _e233: vec4<f32> = ferroUniforms.data[105];
    texel_1 = _e233.y;
    let _e237: vec2<f32> = uv_2;
    let _e238: f32 = texel_1;
    cell = (_e237 / vec2(_e238));
    let _e242: vec2<f32> = cell;
    f = (fract(_e242) - vec2(0.5f));
    let _e248: vec2<f32> = cell;
    let _e253: f32 = texel_1;
    centre_1 = ((floor(_e248) + vec2(0.5f)) * _e253);
    let _e258: vec2<f32> = f;
    let _e263: vec2<f32> = f;
    let _e268: vec2<f32> = f;
    let _e270: vec2<f32> = f;
    let _e276: vec2<f32> = f;
    let _e281: vec2<f32> = f;
    wx = vec3<f32>(((0.5f * (0.5f - _e258.x)) * (0.5f - _e263.x)), (0.75f - (_e268.x * _e270.x)), ((0.5f * (0.5f + _e276.x)) * (0.5f + _e281.x)));
    let _e289: vec2<f32> = f;
    let _e294: vec2<f32> = f;
    let _e299: vec2<f32> = f;
    let _e301: vec2<f32> = f;
    let _e307: vec2<f32> = f;
    let _e312: vec2<f32> = f;
    wy = vec3<f32>(((0.5f * (0.5f - _e289.y)) * (0.5f - _e294.y)), (0.75f - (_e299.y * _e301.y)), ((0.5f * (0.5f + _e307.y)) * (0.5f + _e312.y)));
    loop {
        let _e322: i32 = y;
        if !((_e322 < 3i)) {
            break;
        }
        x = 0i;
        loop {
            let _e331: i32 = x;
            if !((_e331 < 3i)) {
                break;
            }
            {
                let _e338: vec2<f32> = centre_1;
                let _e339: i32 = x;
                let _e343: i32 = y;
                let _e348: f32 = texel_1;
                tap_1 = (_e338 + (vec2<f32>(f32((_e339 - 1i)), f32((_e343 - 1i))) * _e348));
                let _e352: f32 = v;
                let _e353: i32 = x;
                let _e355: f32 = wx[_e353];
                let _e356: i32 = y;
                let _e358: f32 = wy[_e356];
                let _e360: f32 = z;
                let _e361: vec2<f32> = pente_2;
                let _e362: vec2<f32> = tap_1;
                let _e363: vec2<f32> = uv_2;
                let _e367: vec2<f32> = tap_1;
                let _e370: vec2<f32> = tap_1;
                let _e375: vec4<f32> = vec4<f32>(textureSampleLevel(uPdrOmbre_texture, uPdrOmbre_sampler, vec2<f32>(_e367.x, (1f - _e370.y)),0),0.0,0.0,1.0);
                v = (_e352 + ((_e355 * _e358) * step((_e360 + dot(_e361, (_e362 - _e363))), _e375.x)));
            }
            continuing {
                let _e335: i32 = x;
                x = (_e335 + 1i);
            }
        }
        continuing {
            let _e326: i32 = y;
            y = (_e326 + 1i);
        }
    }
    let _e380: vec3<f32> = p;
    let _e382: vec3<f32> = p;
    let _e386: vec3<f32> = p;
    let _e390: vec3<f32> = p;
    bord = min(min(_e380.x, _e382.y), min((1f - _e386.x), (1f - _e390.y)));
    let _e399: f32 = v;
    let _e403: f32 = bord;
    return mix(1f, mix(0.055f, 1f, _e399), smoothstep(0.012f, 0.085f, _e403));
}

fn pdrFresnel(c: f32, f0_: vec3<f32>) -> vec3<f32> {
    var c_1: f32;
    var f0_1: vec3<f32>;
    var q: f32;
    var q2_: f32;

    c_1 = c;
    f0_1 = f0_;
    let _e14: f32 = c_1;
    q = (1f - clamp(_e14, 0f, 1f));
    let _e20: f32 = q;
    let _e21: f32 = q;
    q2_ = (_e20 * _e21);
    let _e24: vec3<f32> = f0_1;
    let _e26: vec3<f32> = f0_1;
    let _e29: f32 = q2_;
    let _e31: f32 = q2_;
    let _e33: f32 = q;
    return (_e24 + ((((vec3(1f) - _e26) * _e29) * _e31) * _e33));
}

fn pdrReflet(n_2: vec3<f32>, vue: vec3<f32>, l: vec3<f32>, rugosite: f32, f0_2: vec3<f32>) -> vec3<f32> {
    var n_3: vec3<f32>;
    var vue_1: vec3<f32>;
    var l_1: vec3<f32>;
    var rugosite_1: f32;
    var f0_3: vec3<f32>;
    var h: vec3<f32>;
    var nv: f32;
    var nl: f32;
    var nh: f32;
    var a: f32;
    var a2_: f32;
    var d: f32;
    var k: f32;

    n_3 = n_2;
    vue_1 = vue;
    l_1 = l;
    rugosite_1 = rugosite;
    f0_3 = f0_2;
    let _e19: vec3<f32> = vue_1;
    let _e20: vec3<f32> = l_1;
    h = normalize((_e19 + _e20));
    let _e24: vec3<f32> = n_3;
    let _e25: vec3<f32> = vue_1;
    nv = max(dot(_e24, _e25), 0.001f);
    let _e30: vec3<f32> = n_3;
    let _e31: vec3<f32> = l_1;
    nl = max(dot(_e30, _e31), 0f);
    let _e36: vec3<f32> = n_3;
    let _e37: vec3<f32> = h;
    nh = max(dot(_e36, _e37), 0f);
    let _e43: f32 = rugosite_1;
    let _e44: f32 = rugosite_1;
    a = max(0.055f, (_e43 * _e44));
    let _e48: f32 = a;
    let _e49: f32 = a;
    a2_ = (_e48 * _e49);
    let _e52: f32 = nh;
    let _e53: f32 = nh;
    let _e55: f32 = a2_;
    d = (((_e52 * _e53) * (_e55 - 1f)) + 1f);
    let _e62: f32 = rugosite_1;
    let _e65: f32 = rugosite_1;
    k = (((_e62 + 1f) * (_e65 + 1f)) * 0.125f);
    let _e72: vec3<f32> = vue_1;
    let _e73: vec3<f32> = h;
    let _e77: vec3<f32> = f0_3;
    let _e78: vec3<f32> = pdrFresnel(max(dot(_e72, _e73), 0f), _e77);
    let _e79: f32 = a2_;
    let _e81: f32 = d;
    let _e83: f32 = d;
    let _e89: f32 = nv;
    let _e91: f32 = k;
    let _e94: f32 = k;
    let _e97: f32 = nl;
    let _e99: f32 = k;
    let _e102: f32 = k;
    let _e111: f32 = nl;
    return ((_e78 * min(((_e79 / max(((3.141593f * _e81) * _e83), 0.00001f)) / max(((4f * ((_e89 * (1f - _e91)) + _e94)) * ((_e97 * (1f - _e99)) + _e102)), 0.001f)), 12f)) * _e111);
}

fn pdrEclairer(base: vec3<f32>, n_4: vec3<f32>, monde_2: vec3<f32>, rugosite_2: f32, metal: f32, emission: f32, ombre: f32) -> vec3<f32> {
    var base_1: vec3<f32>;
    var n_5: vec3<f32>;
    var monde_3: vec3<f32>;
    var rugosite_3: f32;
    var metal_1: f32;
    var emission_1: f32;
    var ombre_1: f32;
    var vue_2: vec3<f32>;
    var f0_4: vec3<f32>;
    var lumiere: vec3<f32>;
    var reflet: vec3<f32> = vec3(0f);
    var i: i32 = 0i;
    var versLumiere: vec3<f32>;
    var d_1: f32;
    var l_2: vec3<f32>;
    var local_3: f32;
    var attenuation: f32;
    var couleur: vec3<f32>;
    var r: vec3<f32>;
    var ciel: vec3<f32>;
    var milieu: vec3<f32>;
    var rasant: f32;

    base_1 = base;
    n_5 = n_4;
    monde_3 = monde_2;
    rugosite_3 = rugosite_2;
    metal_1 = metal;
    emission_1 = emission;
    ombre_1 = ombre;
    let _e26: vec4<f32> = ferroUniforms.data[106];
    let _e28: vec3<f32> = monde_3;
    vue_2 = normalize((_e26.xyz - _e28));
    let _e34: vec3<f32> = base_1;
    let _e40: f32 = metal_1;
    f0_4 = mix(vec3(0.04f), clamp(_e34, vec3(0.025f), vec3(0.92f)), vec3(_e40));
    let _e47: vec4<f32> = ferroUniforms.data[109];
    let _e51: vec3<f32> = n_5;
    lumiere = (_e47.xyz * (0.72f + (0.28f * max(_e51.y, 0f))));
    loop {
        let _e64: i32 = i;
        if !((_e64 < 12i)) {
            break;
        }
        {
            let _e71: i32 = i;
            let _e75: vec4<f32> = ferroUniforms.data[175];
            if (_e71 >= bitcast<i32>(_e75.x)) {
                break;
            }
            let _e79: i32 = i;
            let _e81: vec3<f32> = ferro_uPdrLumierePosition(i32(_e79));
            let _e82: vec3<f32> = monde_3;
            versLumiere = (_e81 - _e82);
            let _e85: vec3<f32> = versLumiere;
            d_1 = length(_e85);
            let _e88: vec3<f32> = versLumiere;
            let _e89: f32 = d_1;
            l_2 = (_e88 / vec3(max(_e89, 0.001f)));
            let _e95: i32 = i;
            if (_e95 < 2i) {
                local_3 = 0.27f;
            } else {
                local_3 = 0.13f;
            }
            let _e101: f32 = local_3;
            let _e103: f32 = d_1;
            let _e104: f32 = d_1;
            attenuation = (_e101 / (1f + ((_e103 * _e104) * 0.26f)));
            let _e111: i32 = i;
            let _e113: f32 = ferro_uPdrLumierePortee(i32(_e111));
            if (_e113 > 0f) {
                let _e116: f32 = attenuation;
                let _e118: i32 = i;
                let _e120: f32 = ferro_uPdrLumierePortee(i32(_e118));
                let _e123: i32 = i;
                let _e125: f32 = ferro_uPdrLumierePortee(i32(_e123));
                let _e126: f32 = d_1;
                attenuation = (_e116 * (1f - smoothstep((_e120 * 0.35f), _e125, _e126)));
            }
            let _e130: i32 = i;
            let _e132: vec2<f32> = ferro_uPdrLumiereCone(i32(_e130));
            if (_e132.x > 0f) {
                let _e136: f32 = attenuation;
                let _e137: i32 = i;
                let _e139: vec2<f32> = ferro_uPdrLumiereCone(i32(_e137));
                let _e141: i32 = i;
                let _e143: vec2<f32> = ferro_uPdrLumiereCone(i32(_e141));
                let _e145: vec3<f32> = l_2;
                let _e147: i32 = i;
                let _e149: vec3<f32> = ferro_uPdrLumiereDirection(i32(_e147));
                attenuation = (_e136 * smoothstep(_e139.x, _e143.y, dot(-(_e145), _e149)));
            }
            let _e153: vec3<f32> = lumiere;
            let _e154: i32 = i;
            let _e156: vec3<f32> = ferro_uPdrLumiereCouleur(i32(_e154));
            let _e157: f32 = attenuation;
            let _e159: vec3<f32> = n_5;
            let _e160: vec3<f32> = l_2;
            lumiere = (_e153 + ((_e156 * _e157) * (max(dot(_e159, _e160), 0f) + 0.035f)));
            let _e168: vec3<f32> = reflet;
            let _e169: i32 = i;
            let _e171: vec3<f32> = ferro_uPdrLumiereCouleur(i32(_e169));
            let _e172: f32 = attenuation;
            let _e174: vec3<f32> = n_5;
            let _e175: vec3<f32> = vue_2;
            let _e176: vec3<f32> = l_2;
            let _e177: f32 = rugosite_3;
            let _e178: vec3<f32> = f0_4;
            let _e179: vec3<f32> = pdrReflet(_e174, _e175, _e176, _e177, _e178);
            reflet = (_e168 + (((_e171 * _e172) * _e179) * 2.4f));
        }
        continuing {
            let _e68: i32 = i;
            i = (_e68 + 1i);
        }
    }
    let _e184: vec3<f32> = lumiere;
    let _e188: vec4<f32> = ferroUniforms.data[108];
    let _e190: vec3<f32> = n_5;
    let _e194: vec4<f32> = ferroUniforms.data[107];
    let _e200: f32 = ombre_1;
    lumiere = (_e184 + ((_e188.xyz * max(dot(_e190, _e194.xyz), 0f)) * _e200));
    let _e203: vec3<f32> = reflet;
    let _e207: vec4<f32> = ferroUniforms.data[108];
    let _e209: f32 = ombre_1;
    let _e211: vec3<f32> = n_5;
    let _e212: vec3<f32> = vue_2;
    let _e216: vec4<f32> = ferroUniforms.data[107];
    let _e218: f32 = rugosite_3;
    let _e219: vec3<f32> = f0_4;
    let _e220: vec3<f32> = pdrReflet(_e211, _e212, _e216.xyz, _e218, _e219);
    reflet = (_e203 + ((_e207.xyz * _e209) * _e220));
    let _e223: vec3<f32> = base_1;
    let _e224: vec3<f32> = lumiere;
    let _e226: vec3<f32> = reflet;
    couleur = ((_e223 * _e224) + _e226);
    let _e229: vec3<f32> = vue_2;
    let _e231: vec3<f32> = n_5;
    r = reflect(-(_e229), _e231);
    let _e237: vec4<f32> = ferroUniforms.data[112];
    let _e242: vec4<f32> = ferroUniforms.data[111];
    let _e246: vec3<f32> = r;
    ciel = mix(_e237.xyz, _e242.xyz, vec3(smoothstep(0f, 1f, _e246.y)));
    let _e255: vec4<f32> = ferroUniforms.data[109];
    let _e259: vec3<f32> = ciel;
    let _e263: vec3<f32> = r;
    let _e271: vec4<f32> = ferroUniforms.data[109];
    let _e275: f32 = rugosite_3;
    let _e276: f32 = rugosite_3;
    milieu = mix(mix((_e255.xyz * 0.2f), _e259, vec3(smoothstep(-0.16f, 0.18f, _e263.y))), (_e271.xyz * 0.85f), vec3(((_e275 * _e276) * 0.8f)));
    let _e284: vec3<f32> = n_5;
    let _e285: vec3<f32> = vue_2;
    rasant = pow((1f - max(dot(_e284, _e285), 0f)), 5f);
    let _e293: vec3<f32> = couleur;
    let _e294: vec3<f32> = milieu;
    let _e295: vec3<f32> = f0_4;
    let _e297: f32 = rugosite_3;
    let _e300: vec3<f32> = f0_4;
    let _e302: vec3<f32> = f0_4;
    let _e304: f32 = rasant;
    let _e311: f32 = rugosite_3;
    let _e315: f32 = rugosite_3;
    let _e321: f32 = metal_1;
    couleur = (_e293 + (((_e294 * (_e295 + ((max(vec3((1f - _e297)), _e300) - _e302) * _e304))) * (0.18f + ((1.3f * (1f - _e311)) * (1f - _e315)))) * (0.5f + (_e321 * 2.5f))));
    let _e327: vec3<f32> = couleur;
    let _e328: vec3<f32> = base_1;
    let _e329: f32 = emission_1;
    let _e336: vec4<f32> = ferroUniforms.data[113];
    let _e341: vec3<f32> = monde_3;
    return (_e327 + (((_e328 * _e329) * (0.94f + (0.06f * sin(((_e336.z * 2.2f) + (_e341.y * 3f)))))) * 1.55f));
}

fn pdrFinir(couleur_1: vec3<f32>, monde_4: vec3<f32>) -> vec3<f32> {
    var couleur_2: vec3<f32>;
    var monde_5: vec3<f32>;
    var brume: f32;

    couleur_2 = couleur_1;
    monde_5 = monde_4;
    let _e17: vec4<f32> = ferroUniforms.data[106];
    let _e19: vec3<f32> = monde_5;
    let _e26: vec4<f32> = ferroUniforms.data[113];
    brume = (1f - exp((-(length((_e17.xyz - _e19))) * _e26.y)));
    let _e33: vec3<f32> = couleur_2;
    let _e37: vec4<f32> = ferroUniforms.data[110];
    let _e39: f32 = brume;
    couleur_2 = mix(_e33, _e37.xyz, vec3(min(_e39, 0.86f)));
    // FERRO 0.3.39 : la scène WebGPU est en radiance linéaire ; la courbe d'affichage et le vignettage se font une
    // seule fois dans post.wgsl. Le public rend sa radiance, brouillard compris, comme les programmes de foule de FERRO.
    let _e44: vec3<f32> = couleur_2;
    return max(_e44, vec3(0f));
}

fn bande(v_1: f32, largeur: f32) -> f32 {
    var v_2: f32;
    var largeur_1: f32;
    var aa: f32;
    var d_2: f32;
    var k_1: f32;

    v_2 = v_1;
    largeur_1 = largeur;
    let _e23: f32 = v_2;
    let _e24: f32 = fwidth(_e23);
    aa = max((_e24 * 1.2f), 0.0001f);
    let _e30: f32 = v_2;
    let _e36: f32 = largeur_1;
    d_2 = (abs((fract(_e30) - 0.5f)) - (0.5f - (_e36 * 0.5f)));
    let _e43: f32 = aa;
    let _e45: f32 = aa;
    let _e46: f32 = d_2;
    k_1 = (1f - smoothstep(-(_e43), _e45, _e46));
    let _e50: f32 = k_1;
    let _e51: f32 = largeur_1;
    let _e54: f32 = aa;
    return mix(_e50, _e51, smoothstep(0.25f, 0.5f, _e54));
}

fn main_1() {
    var d_3: f32;
    var n_6: vec3<f32>;
    var base_2: vec3<f32>;
    var o: vec3<f32>;
    var k_2: f32 = 0f;
    var local_4: f32;
    var l_3: f32;
    var rug: f32;
    var mouille: f32;
    var ombre_2: f32;

    let _e19: vec2<f32> = vTrame_1;
    let _e23: vec2<f32> = vTrame_1;
    if ((_e19.x > 0f) || (_e23.y < 1f)) {
        {
            let _e29: vec4<f32> = gl_FragCoord_1;
            d_3 = fract((52.982918f * fract(dot(_e29.xy, vec2<f32>(0.06711056f, 0.00583715f)))));
            let _e39: f32 = d_3;
            let _e40: vec2<f32> = vTrame_1;
            let _e43: f32 = d_3;
            let _e44: vec2<f32> = vTrame_1;
            if ((_e39 < _e40.x) || (_e43 >= _e44.y)) {
                discard;
            }
        }
    }
    let _e48: vec3<f32> = vNormale_1;
    n_6 = normalize(_e48);
    let _e51: vec3<f32> = vBase_1;
    base_2 = _e51;
    let _e53: vec3<f32> = vObjet_1;
    o = _e53;
    let _e57: u32 = vMotif_1;
    if (_e57 == 1u) {
        let _e60: vec3<f32> = o;
        let _e65: f32 = bande((_e60.y * 15f), 0.45f);
        k_2 = _e65;
    } else {
        let _e66: u32 = vMotif_1;
        if (_e66 == 2u) {
            let _e69: vec3<f32> = o;
            let _e71: vec3<f32> = o;
            let _e79: f32 = bande((atan2(_e69.x, (_e71.z + 0.001f)) * 9f), 0.3f);
            k_2 = _e79;
        } else {
            let _e80: u32 = vMotif_1;
            if (_e80 == 3u) {
                let _e83: vec3<f32> = o;
                let _e88: f32 = bande((_e83.y * 11f), 0.32f);
                let _e89: vec3<f32> = o;
                let _e94: f32 = bande((_e89.x * 11f), 0.32f);
                k_2 = (max(_e88, _e94) * 0.75f);
            } else {
                let _e98: u32 = vMotif_1;
                if (_e98 == 4u) {
                    let _e101: vec3<f32> = o;
                    let _e106: vec3<f32> = o;
                    if ((abs(_e101.x) > 0.205f) && (_e106.y < 1.47f)) {
                        local_4 = 1f;
                    } else {
                        local_4 = 0f;
                    }
                    let _e114: f32 = local_4;
                    k_2 = _e114;
                } else {
                    let _e115: u32 = vMotif_1;
                    if (_e115 == 5u) {
                        let _e119: vec3<f32> = o;
                        let _e122: vec3<f32> = o;
                        k_2 = (step(1.26f, _e119.y) * step(_e122.y, 1.34f));
                    } else {
                        let _e127: u32 = vMotif_1;
                        if (_e127 == 6u) {
                            let _e131: vec3<f32> = o;
                            k_2 = step(1.47f, _e131.y);
                        } else {
                            let _e134: u32 = vMotif_1;
                            if (_e134 == 8u) {
                                let _e138: vec3<f32> = o;
                                let _e140: vec3<f32> = o;
                                k_2 = step(0.5f, fract((atan2(_e138.z, _e140.x) * 1.2732395f)));
                            } else {
                                let _e147: u32 = vMotif_1;
                                if (_e147 == 9u) {
                                    let _e151: vec3<f32> = o;
                                    k_2 = step(0.5f, fract(((_e151.y - 0.125f) * 7.4f)));
                                } else {
                                    let _e159: u32 = vMotif_1;
                                    if (_e159 == 10u) {
                                        let _e163: vec3<f32> = o;
                                        let _e166: vec3<f32> = o;
                                        k_2 = (step(0.04f, _e163.z) * step(_e166.y, 1.79f));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    let _e171: vec3<f32> = base_2;
    let _e172: vec3<f32> = vSecond_1;
    let _e173: f32 = k_2;
    base_2 = mix(_e171, _e172, vec3(clamp(_e173, 0f, 1f)));
    let _e179: vec4<f32> = vMatiere_1;
    if (_e179.w > 0.5f) {
        {
            let _e183: vec3<f32> = o;
            let _e190: vec3<f32> = o;
            let _e201: vec3<f32> = o;
            l_3 = (exp((-(pow((_e183.x / 0.022f), 2f)) - pow(((_e190.y - 1.613f) / 0.0055f), 2f))) * step(0.06f, _e201.z));
            let _e206: vec3<f32> = base_2;
            let _e213: f32 = l_3;
            base_2 = (_e206 * mix(vec3(1f), vec3<f32>(0.86f, 0.6f, 0.58f), vec3(_e213)));
        }
    }
    let _e217: vec4<f32> = vMatiere_1;
    rug = _e217.x;
    let _e220: vec4<f32> = vMatiere_1;
    mouille = _e220.z;
    let _e223: vec3<f32> = base_2;
    let _e226: f32 = mouille;
    base_2 = (_e223 * (1f - (0.28f * _e226)));
    let _e230: f32 = rug;
    let _e232: f32 = mouille;
    rug = mix(_e230, 0.35f, (_e232 * 0.6f));
    let _e236: vec3<f32> = vMonde_1;
    let _e237: vec3<f32> = n_6;
    let _e238: f32 = pdrOmbreSoleil(_e236, _e237);
    ombre_2 = _e238;
    let _e240: vec3<f32> = base_2;
    let _e241: vec3<f32> = n_6;
    let _e242: vec3<f32> = vMonde_1;
    let _e243: f32 = rug;
    let _e244: vec4<f32> = vMatiere_1;
    let _e247: f32 = ombre_2;
    let _e248: vec3<f32> = pdrEclairer(_e240, _e241, _e242, _e243, _e244.y, 0f, _e247);
    let _e249: vec3<f32> = vMonde_1;
    let _e250: vec3<f32> = pdrFinir(_e248, _e249);
    fragColor = vec4<f32>(_e250.x, _e250.y, _e250.z, 0f);
    return;
}

@fragment
fn main(@builtin(position) gl_FragCoord: vec4<f32>, @location(0) vMonde: vec3<f32>, @location(1) vNormale: vec3<f32>, @location(2) vObjet: vec3<f32>, @location(3) @interpolate(flat) vBase: vec3<f32>, @location(4) @interpolate(flat) vSecond: vec3<f32>, @location(5) @interpolate(flat) vMatiere: vec4<f32>, @location(6) @interpolate(flat) vTrame: vec2<f32>, @location(7) @interpolate(flat) vMotif: u32) -> FragmentOutput {
    gl_FragCoord_1 = gl_FragCoord;
    vMonde_1 = vMonde;
    vNormale_1 = vNormale;
    vObjet_1 = vObjet;
    vBase_1 = vBase;
    vSecond_1 = vSecond;
    vMatiere_1 = vMatiere;
    vTrame_1 = vTrame;
    vMotif_1 = vMotif;
    main_1();
    let _e52: vec4<f32> = fragColor;
    return FragmentOutput(_e52);
}
`,
    },
    ombre: {
      uniforms: {"byteLength":1616,"fields":[{"name":"uVP","type":"mat4","offset":0,"count":1,"arrayStride":64,"matrixStride":16},{"name":"uTemps","type":"vec4","offset":64,"count":1,"arrayStride":16,"matrixStride":0},{"name":"uSections","type":"vec4","offset":80,"count":48,"arrayStride":16,"matrixStride":0},{"name":"uSections2","type":"vec4","offset":848,"count":48,"arrayStride":16,"matrixStride":0}]},
      textures: [{"name":"uPublicF","binding":1,"samplerBinding":2,"dimension":"2d","depth":false,"sampleType":"unfilterable-float","samplerType":"non-filtering","sourceType":"sampler2D","renderTarget":false},{"name":"uPublicU","binding":3,"samplerBinding":4,"dimension":"2d","depth":false,"sampleType":"uint","samplerType":"non-filtering","sourceType":"usampler2D","renderTarget":false}],
      entryPoint: "main",
      vertex: `diagnostic(off, derivative_uniformity);
struct FerroUniforms {
    data: array<vec4<f32>, 101>,
}

struct Pose {
    hanche: vec2<f32>,
    genou: vec2<f32>,
    cheville: vec2<f32>,
    ecart: vec2<f32>,
    ouvre: vec2<f32>,
    epaule: vec2<f32>,
    abduction: vec2<f32>,
    dedans: vec2<f32>,
    coude: vec2<f32>,
    balancier: vec2<f32>,
    torse: vec3<f32>,
    tete: vec2<f32>,
    souffle: f32,
}

struct VertexOutput {
    @builtin(position) gl_Position: vec4<f32>,
}

const PIV_HANCHES: vec3<f32> = vec3<f32>(0f, 0.95f, 0f);
const PIV_COU: vec3<f32> = vec3<f32>(0f, 1.52f, 0f);

@group(0) @binding(0)
var<uniform> ferroUniforms: FerroUniforms;
@group(0) @binding(1)
var uPublicF_texture: texture_2d<f32>;
@group(0) @binding(2)
var uPublicF_sampler: sampler;
@group(0) @binding(3)
var uPublicU_texture: texture_2d<u32>;
@group(0) @binding(4)
var uPublicU_sampler: sampler;
var<private> aPosition_1: vec3<f32>;
var<private> aNormale_1: vec3<f32>;
var<private> aPoids_1: vec2<f32>;
var<private> aInfo_1: vec4<u32>;
var<private> aSpectateur_1: u32;
var<private> gl_Position: vec4<f32>;

fn ferro_uSections(index: i32) -> vec4<f32> {
    var index_1: i32;

    index_1 = index;
    let _e6: i32 = index_1;
    let _e12: vec4<f32> = ferroUniforms.data[(5i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uSections2_(index_2: i32) -> vec4<f32> {
    var index_3: i32;

    index_3 = index_2;
    let _e6: i32 = index_3;
    let _e12: vec4<f32> = ferroUniforms.data[(53i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn rx(v: vec3<f32>, a: f32) -> vec3<f32> {
    var v_1: vec3<f32>;
    var a_1: f32;
    var c: f32;
    var s: f32;

    v_1 = v;
    a_1 = a;
    let _e18: f32 = a_1;
    c = cos(_e18);
    let _e21: f32 = a_1;
    s = sin(_e21);
    let _e24: vec3<f32> = v_1;
    let _e26: vec3<f32> = v_1;
    let _e28: f32 = c;
    let _e30: vec3<f32> = v_1;
    let _e32: f32 = s;
    let _e35: vec3<f32> = v_1;
    let _e38: f32 = s;
    let _e40: vec3<f32> = v_1;
    let _e42: f32 = c;
    return vec3<f32>(_e24.x, ((_e26.y * _e28) + (_e30.z * _e32)), ((-(_e35.y) * _e38) + (_e40.z * _e42)));
}

fn ry(v_2: vec3<f32>, a_2: f32) -> vec3<f32> {
    var v_3: vec3<f32>;
    var a_3: f32;
    var c_1: f32;
    var s_1: f32;

    v_3 = v_2;
    a_3 = a_2;
    let _e18: f32 = a_3;
    c_1 = cos(_e18);
    let _e21: f32 = a_3;
    s_1 = sin(_e21);
    let _e24: vec3<f32> = v_3;
    let _e26: f32 = c_1;
    let _e28: vec3<f32> = v_3;
    let _e30: f32 = s_1;
    let _e33: vec3<f32> = v_3;
    let _e35: vec3<f32> = v_3;
    let _e38: f32 = s_1;
    let _e40: vec3<f32> = v_3;
    let _e42: f32 = c_1;
    return vec3<f32>(((_e24.x * _e26) + (_e28.z * _e30)), _e33.y, ((-(_e35.x) * _e38) + (_e40.z * _e42)));
}

fn rz(v_4: vec3<f32>, a_4: f32) -> vec3<f32> {
    var v_5: vec3<f32>;
    var a_5: f32;
    var c_2: f32;
    var s_2: f32;

    v_5 = v_4;
    a_5 = a_4;
    let _e18: f32 = a_5;
    c_2 = cos(_e18);
    let _e21: f32 = a_5;
    s_2 = sin(_e21);
    let _e24: vec3<f32> = v_5;
    let _e26: f32 = c_2;
    let _e28: vec3<f32> = v_5;
    let _e30: f32 = s_2;
    let _e33: vec3<f32> = v_5;
    let _e35: f32 = s_2;
    let _e37: vec3<f32> = v_5;
    let _e39: f32 = c_2;
    let _e42: vec3<f32> = v_5;
    return vec3<f32>(((_e24.x * _e26) - (_e28.y * _e30)), ((_e33.x * _e35) + (_e37.y * _e39)), _e42.z);
}

fn couleur(c_3: u32) -> vec3<f32> {
    var c_4: u32;

    c_4 = c_3;
    let _e16: u32 = c_4;
    let _e23: u32 = c_4;
    let _e30: u32 = c_4;
    return (vec3<f32>(f32(((_e16 >> 16u) & 255u)), f32(((_e23 >> 8u) & 255u)), f32((_e30 & 255u))) / vec3(255f));
}

fn poserOs(p: ptr<function, vec3<f32>>, n: ptr<function, vec3<f32>>, os: u32, q: Pose) {
    var os_1: u32;
    var q_1: Pose;
    var local: i32;
    var c_5: i32;
    var local_1: f32;
    var sx: f32;
    var k: vec3<f32>;
    var k_1: vec3<f32>;
    var k_2: vec3<f32>;
    var local_2: i32;
    var c_6: i32;
    var local_3: f32;
    var sx_1: f32;
    var k_3: vec3<f32>;
    var k_4: vec3<f32>;
    var d: f32;
    var ab: f32;
    var w: f32;

    os_1 = os;
    q_1 = q;
    let _e20: u32 = os_1;
    let _e23: u32 = os_1;
    let _e27: u32 = os_1;
    let _e31: u32 = os_1;
    let _e35: u32 = os_1;
    if (((((_e20 == 4u) || (_e23 == 5u)) || (_e27 == 16u)) || (_e31 == 17u)) || (_e35 >= 20u)) {
        {
            let _e39: u32 = os_1;
            let _e42: u32 = os_1;
            let _e46: u32 = os_1;
            if (((_e39 == 4u) || (_e42 == 16u)) || (_e46 == 20u)) {
                local = 0i;
            } else {
                local = 1i;
            }
            let _e53: i32 = local;
            c_5 = _e53;
            let _e55: i32 = c_5;
            if (_e55 == 0i) {
                local_1 = -0.105f;
            } else {
                local_1 = 0.105f;
            }
            let _e62: f32 = local_1;
            sx = _e62;
            let _e64: u32 = os_1;
            if (_e64 >= 20u) {
                {
                    let _e67: f32 = sx;
                    k = vec3<f32>(_e67, 0.145f, 0f);
                    let _e72: vec3<f32> = k;
                    let _e73: vec3<f32> = (*p);
                    let _e74: vec3<f32> = k;
                    let _e76: i32 = c_5;
                    let _e79: f32 = q_1.cheville[_e76];
                    let _e80: vec3<f32> = rx((_e73 - _e74), _e79);
                    (*p) = (_e72 + _e80);
                    let _e82: vec3<f32> = (*n);
                    let _e83: i32 = c_5;
                    let _e86: f32 = q_1.cheville[_e83];
                    let _e87: vec3<f32> = rx(_e82, _e86);
                    (*n) = _e87;
                }
            }
            let _e88: u32 = os_1;
            if (_e88 >= 16u) {
                {
                    let _e91: f32 = sx;
                    k_1 = vec3<f32>(_e91, 0.52f, 0f);
                    let _e96: vec3<f32> = k_1;
                    let _e97: vec3<f32> = (*p);
                    let _e98: vec3<f32> = k_1;
                    let _e100: i32 = c_5;
                    let _e103: f32 = q_1.genou[_e100];
                    let _e104: vec3<f32> = rx((_e97 - _e98), _e103);
                    (*p) = (_e96 + _e104);
                    let _e106: vec3<f32> = (*n);
                    let _e107: i32 = c_5;
                    let _e110: f32 = q_1.genou[_e107];
                    let _e111: vec3<f32> = rx(_e106, _e110);
                    (*n) = _e111;
                }
            }
            let _e112: f32 = sx;
            k_2 = vec3<f32>(_e112, 0.97f, 0f);
            let _e117: vec3<f32> = k_2;
            let _e118: vec3<f32> = (*p);
            let _e119: vec3<f32> = k_2;
            let _e121: i32 = c_5;
            let _e124: f32 = q_1.hanche[_e121];
            let _e125: vec3<f32> = rx((_e118 - _e119), _e124);
            let _e126: i32 = c_5;
            let _e129: f32 = q_1.ouvre[_e126];
            let _e130: vec3<f32> = ry(_e125, _e129);
            let _e131: i32 = c_5;
            let _e134: f32 = q_1.ecart[_e131];
            let _e135: vec3<f32> = rz(_e130, _e134);
            (*p) = (_e117 + _e135);
            let _e137: vec3<f32> = (*n);
            let _e138: i32 = c_5;
            let _e141: f32 = q_1.hanche[_e138];
            let _e142: vec3<f32> = rx(_e137, _e141);
            let _e143: i32 = c_5;
            let _e146: f32 = q_1.ouvre[_e143];
            let _e147: vec3<f32> = ry(_e142, _e146);
            let _e148: i32 = c_5;
            let _e151: f32 = q_1.ecart[_e148];
            let _e152: vec3<f32> = rz(_e147, _e151);
            (*n) = _e152;
            return;
        }
    }
    let _e153: u32 = os_1;
    let _e156: u32 = os_1;
    let _e160: u32 = os_1;
    let _e164: u32 = os_1;
    if ((((_e153 == 2u) || (_e156 == 3u)) || (_e160 == 18u)) || (_e164 == 19u)) {
        {
            let _e168: u32 = os_1;
            let _e171: u32 = os_1;
            if ((_e168 == 2u) || (_e171 == 18u)) {
                local_2 = 0i;
            } else {
                local_2 = 1i;
            }
            let _e178: i32 = local_2;
            c_6 = _e178;
            let _e180: i32 = c_6;
            if (_e180 == 0i) {
                local_3 = -1f;
            } else {
                local_3 = 1f;
            }
            let _e187: f32 = local_3;
            sx_1 = _e187;
            let _e189: u32 = os_1;
            if (_e189 >= 18u) {
                {
                    let _e192: f32 = sx_1;
                    k_3 = vec3<f32>((_e192 * 0.255f), 1.19f, 0f);
                    let _e199: vec3<f32> = k_3;
                    let _e200: vec3<f32> = (*p);
                    let _e201: vec3<f32> = k_3;
                    let _e203: i32 = c_6;
                    let _e206: f32 = q_1.coude[_e203];
                    let _e207: vec3<f32> = rx((_e200 - _e201), _e206);
                    let _e208: f32 = sx_1;
                    let _e209: i32 = c_6;
                    let _e212: f32 = q_1.balancier[_e209];
                    let _e214: vec3<f32> = rz(_e207, (_e208 * _e212));
                    (*p) = (_e199 + _e214);
                    let _e216: vec3<f32> = (*n);
                    let _e217: i32 = c_6;
                    let _e220: f32 = q_1.coude[_e217];
                    let _e221: vec3<f32> = rx(_e216, _e220);
                    let _e222: f32 = sx_1;
                    let _e223: i32 = c_6;
                    let _e226: f32 = q_1.balancier[_e223];
                    let _e228: vec3<f32> = rz(_e221, (_e222 * _e226));
                    (*n) = _e228;
                }
            }
            let _e229: f32 = sx_1;
            k_4 = vec3<f32>((_e229 * 0.235f), 1.43f, 0f);
            let _e236: f32 = sx_1;
            let _e238: i32 = c_6;
            let _e241: f32 = q_1.dedans[_e238];
            d = (-(_e236) * _e241);
            let _e244: f32 = sx_1;
            let _e245: i32 = c_6;
            let _e248: f32 = q_1.abduction[_e245];
            ab = (_e244 * _e248);
            let _e251: vec3<f32> = k_4;
            let _e252: vec3<f32> = (*p);
            let _e253: vec3<f32> = k_4;
            let _e255: f32 = d;
            let _e256: vec3<f32> = ry((_e252 - _e253), _e255);
            let _e257: i32 = c_6;
            let _e260: f32 = q_1.epaule[_e257];
            let _e261: vec3<f32> = rx(_e256, _e260);
            let _e262: f32 = ab;
            let _e263: vec3<f32> = rz(_e261, _e262);
            (*p) = (_e251 + _e263);
            let _e265: vec3<f32> = (*n);
            let _e266: f32 = d;
            let _e267: vec3<f32> = ry(_e265, _e266);
            let _e268: i32 = c_6;
            let _e271: f32 = q_1.epaule[_e268];
            let _e272: vec3<f32> = rx(_e267, _e271);
            let _e273: f32 = ab;
            let _e274: vec3<f32> = rz(_e272, _e273);
            (*n) = _e274;
            let _e276: vec3<f32> = (*p);
            let _e279: Pose = q_1;
            (*p).y = (_e276.y + (0.004f * _e279.souffle));
        }
    } else {
        let _e283: u32 = os_1;
        if (_e283 == 1u) {
            {
                let _e286: vec3<f32> = (*p);
                let _e288: Pose = q_1;
                let _e292: vec3<f32> = rx((_e286 - PIV_COU), -(_e288.tete.y));
                let _e293: Pose = q_1;
                let _e296: vec3<f32> = ry(_e292, _e293.tete.x);
                (*p) = (PIV_COU + _e296);
                let _e298: vec3<f32> = (*n);
                let _e299: Pose = q_1;
                let _e303: vec3<f32> = rx(_e298, -(_e299.tete.y));
                let _e304: Pose = q_1;
                let _e307: vec3<f32> = ry(_e303, _e304.tete.x);
                (*n) = _e307;
            }
        } else {
            {
                let _e310: vec3<f32> = (*p);
                let _e316: vec3<f32> = (*p);
                w = (smoothstep(1.06f, 1.2f, _e310.y) * (1f - smoothstep(1.4f, 1.48f, _e316.y)));
                let _e322: vec3<f32> = (*p);
                let _e324: vec3<f32> = (*p);
                let _e328: Pose = q_1;
                let _e331: f32 = w;
                let _e334: vec2<f32> = (_e324.xz * (1f + ((0.013f * _e328.souffle) * _e331)));
                (*p).x = _e334.x;
                (*p).z = _e334.y;
            }
        }
    }
    let _e339: vec3<f32> = (*p);
    let _e341: Pose = q_1;
    let _e345: vec3<f32> = rx((_e339 - PIV_HANCHES), -(_e341.torse.x));
    let _e346: Pose = q_1;
    let _e349: vec3<f32> = rz(_e345, _e346.torse.y);
    let _e350: Pose = q_1;
    let _e353: vec3<f32> = ry(_e349, _e350.torse.z);
    (*p) = (PIV_HANCHES + _e353);
    let _e355: vec3<f32> = (*n);
    let _e356: Pose = q_1;
    let _e360: vec3<f32> = rx(_e355, -(_e356.torse.x));
    let _e361: Pose = q_1;
    let _e364: vec3<f32> = rz(_e360, _e361.torse.y);
    let _e365: Pose = q_1;
    let _e368: vec3<f32> = ry(_e364, _e365.torse.z);
    (*n) = _e368;
    return;
}

fn cacher() {
    gl_Position = vec4<f32>(0f, 0f, 3f, 1f);
    return;
}

fn ferro_main() {
    var idx: u32;
    var lo8_: u32;
    var hi8_: u32;
    var t0_: vec2<i32>;
    var t1_: vec2<i32>;
    var U0_: vec4<u32>;
    var os_2: u32;
    var teinte: u32;
    var partie: u32;
    var mat: u32;
    var g: u32;
    var masque: u32;
    var traits: u32;
    var section: u32;
    var assis: bool;
    var h1_: f32;
    var h2_: f32;
    var h3_: f32;
    var h4_: f32;
    var t: f32;
    var S: vec4<f32>;
    var S2_: vec4<f32>;
    var exc: f32;
    var seuil: f32;
    var local_4: f32;
    var lever: f32;
    var lev: f32;
    var agite: f32;
    var deuxBras: bool;
    var applaudit: bool;
    var abri: u32;
    var posture: u32;
    var couvert: f32;
    var local_5: f32;
    var parapluie: f32;
    var local_6: f32;
    var capuche: f32;
    var local_7: f32;
    var drapeau: f32;
    var ph: f32;
    var souffle: f32;
    var om: f32;
    var q_2: Pose;
    var hA: f32;
    var gA: f32;
    var ouvre: f32;
    var c_7: i32 = 0i;
    var local_8: f32;
    var sc: f32;
    var local_9: f32;
    var appui: f32;
    var R0_: vec4<f32>;
    var local_10: vec4<f32>;
    var local_11: vec4<f32>;
    var local_12: vec4<f32>;
    var local_13: vec4<f32>;
    var local_14: f32;
    var c_8: i32 = 0i;
    var r: vec4<f32>;
    var k_5: f32;
    var c_9: i32 = 0i;
    var c_10: i32 = 0i;
    var local_15: f32;
    var bras: f32;
    var k_6: f32;
    var k_7: f32;
    var local_16: f32;
    var local_17: f32;
    var local_18: f32;
    var penche: f32;
    var local_19: f32;
    var A: vec4<f32>;
    var Bf: vec4<f32>;
    var ancre: vec3<f32>;
    var cap: f32;
    var cc: f32;
    var sc_1: f32;
    var X: vec3<f32>;
    var Fv: vec3<f32>;
    var teteMonde: vec3<f32>;
    var d_1: vec3<f32>;
    var lx: f32;
    var lz: f32;
    var lacet: f32;
    var tangage: f32;
    var poids: f32;
    var oisif: f32;
    var local_20: f32;
    var saut: f32;
    var p_1: vec3<f32>;
    var n_1: vec3<f32>;
    var objet: vec3<f32>;
    var v_6: f32;
    var jaw: f32;
    var upper: f32;
    var k_8: f32;
    var k_9: vec3<f32> = vec3<f32>(0f, 1.53f, -0.07f);
    var a_6: f32;
    var e: f32;
    var u: f32;
    var main_1: vec3<f32> = vec3<f32>(0.262f, 0.905f, 0.02f);
    var mn: vec3<f32> = vec3<f32>(0f, 1f, 0f);
    var local_21: f32;
    var r_1: f32;
    var l: vec3<f32>;
    var pa: vec3<f32>;
    var na: vec3<f32>;
    var pb: vec3<f32>;
    var nb: vec3<f32>;
    var echelle: vec3<f32>;
    var pivot: vec3<f32>;
    var monde: vec3<f32>;

    let _e15: u32 = aSpectateur_1;
    idx = (_e15 & 65535u);
    let _e19: u32 = aSpectateur_1;
    lo8_ = ((_e19 >> 16u) & 255u);
    let _e26: u32 = aSpectateur_1;
    hi8_ = (_e26 >> 24u);
    let _e31: u32 = idx;
    let _e37: u32 = idx;
    t0_ = vec2<i32>(i32(((_e31 * 2u) & 1023u)), i32(((_e37 * 2u) >> 10u)));
    let _e46: vec2<i32> = t0_;
    let _e50: vec2<i32> = t0_;
    t1_ = vec2<i32>((_e46.x + 1i), _e50.y);
    let _e54: u32 = hi8_;
    let _e55: u32 = lo8_;
    if (_e54 <= _e55) {
        {
            cacher();
            return;
        }
    }
    let _e57: vec2<i32> = t0_;
    let _e59: vec4<u32> = textureLoad(uPublicU_texture, _e57, 0i);
    U0_ = _e59;
    let _e61: vec4<u32> = aInfo_1;
    os_2 = _e61.x;
    let _e64: vec4<u32> = aInfo_1;
    teinte = _e64.y;
    let _e67: vec4<u32> = aInfo_1;
    partie = _e67.z;
    let _e70: vec4<u32> = aInfo_1;
    mat = (_e70.w & 31u);
    let _e75: vec4<u32> = U0_;
    g = _e75.x;
    let _e78: vec4<u32> = U0_;
    masque = _e78.y;
    let _e81: vec4<u32> = U0_;
    traits = _e81.z;
    let _e84: vec4<u32> = U0_;
    section = min((_e84.w & 255u), 47u);
    let _e91: u32 = traits;
    assis = ((_e91 & 3u) == 0u);
    let _e97: u32 = masque;
    let _e98: u32 = partie;
    if (((_e97 >> _e98) & 1u) == 0u) {
        {
            cacher();
            return;
        }
    }
    let _e104: u32 = g;
    h1_ = (f32((_e104 & 255u)) / 255f);
    let _e111: u32 = g;
    h2_ = (f32(((_e111 >> 8u) & 255u)) / 255f);
    let _e121: u32 = g;
    h3_ = (f32(((_e121 >> 16u) & 255u)) / 255f);
    let _e131: u32 = g;
    h4_ = (f32(((_e131 >> 24u) & 255u)) / 255f);
    let _e144: vec4<f32> = ferroUniforms.data[4];
    t = _e144.x;
    let _e148: u32 = section;
    let _e150: vec4<f32> = ferro_uSections(i32(_e148));
    S = _e150;
    let _e152: u32 = section;
    let _e154: vec4<f32> = ferro_uSections2_(i32(_e152));
    S2_ = _e154;
    let _e156: vec4<f32> = S;
    let _e158: vec4<f32> = S2_;
    let _e162: f32 = h2_;
    exc = clamp(max(_e156.w, (_e158.y * (0.55f + (0.5f * _e162)))), 0f, 1f);
    let _e173: f32 = h1_;
    seuil = (0.16f + (0.95f * _e173));
    let _e177: bool = assis;
    if _e177 {
        let _e178: f32 = seuil;
        let _e179: f32 = seuil;
        let _e182: f32 = exc;
        local_4 = smoothstep(_e178, (_e179 + 0.17f), _e182);
    } else {
        local_4 = 1f;
    }
    let _e186: f32 = local_4;
    lever = _e186;
    let _e188: f32 = lever;
    let _e189: f32 = lever;
    let _e193: f32 = lever;
    lev = ((_e188 * _e189) * (3f - (2f * _e193)));
    let _e198: f32 = seuil;
    let _e201: f32 = seuil;
    let _e204: f32 = exc;
    agite = smoothstep((_e198 + 0.04f), (_e201 + 0.28f), _e204);
    let _e207: u32 = traits;
    deuxBras = (((_e207 >> 15u) & 1u) == 1u);
    let _e216: u32 = traits;
    applaudit = (((_e216 >> 16u) & 1u) == 1u);
    let _e225: u32 = traits;
    abri = ((_e225 >> 22u) & 3u);
    let _e232: u32 = traits;
    posture = ((_e232 >> 28u) & 3u);
    let _e241: f32 = h3_;
    let _e246: f32 = h3_;
    let _e252: vec4<f32> = ferroUniforms.data[4];
    couvert = smoothstep((0.06f + (0.3f * _e241)), (0.2f + (0.3f * _e246)), _e252.y);
    let _e257: u32 = abri;
    if (_e257 == 1u) {
        let _e260: f32 = couvert;
        local_5 = _e260;
    } else {
        local_5 = 0f;
    }
    let _e263: f32 = local_5;
    parapluie = _e263;
    let _e265: u32 = abri;
    if (_e265 == 2u) {
        let _e268: f32 = couvert;
        local_6 = _e268;
    } else {
        local_6 = 0f;
    }
    let _e271: f32 = local_6;
    capuche = _e271;
    let _e273: u32 = masque;
    if (((_e273 >> 11u) & 1u) == 1u) {
        let _e282: f32 = agite;
        local_7 = smoothstep(0.05f, 0.3f, _e282);
    } else {
        local_7 = 0f;
    }
    let _e286: f32 = local_7;
    drapeau = _e286;
    let _e288: u32 = partie;
    let _e291: f32 = parapluie;
    let _e295: u32 = partie;
    let _e298: f32 = drapeau;
    if (((_e288 == 10u) && (_e291 < 0.02f)) || ((_e295 == 11u) && (_e298 < 0.02f))) {
        {
            cacher();
            return;
        }
    }
    let _e304: f32 = h4_;
    ph = (6.2831855f * _e304);
    let _e307: f32 = t;
    let _e310: f32 = h3_;
    let _e314: f32 = ph;
    souffle = sin(((_e307 * (1.25f + (0.5f * _e310))) + _e314));
    let _e320: f32 = h2_;
    om = (9f + (5f * _e320));
    let _e326: f32 = souffle;
    q_2.souffle = _e326;
    let _e329: f32 = h3_;
    hA = (1.36f + (0.1f * (_e329 - 0.5f)));
    let _e335: f32 = hA;
    gA = -((_e335 + 0.04f));
    let _e342: f32 = h2_;
    ouvre = (0.06f + (0.12f * _e342));
    loop {
        let _e348: i32 = c_7;
        if !((_e348 < 2i)) {
            break;
        }
        {
            let _e355: i32 = c_7;
            if (_e355 == 0i) {
                local_8 = -1f;
            } else {
                local_8 = 1f;
            }
            let _e362: f32 = local_8;
            sc = _e362;
            let _e364: bool = assis;
            if _e364 {
                local_9 = 0f;
            } else {
                let _e368: f32 = t;
                let _e371: f32 = ph;
                let _e373: i32 = c_7;
                let _e382: f32 = agite;
                local_9 = ((0.06f * max(0f, sin((((_e368 * 0.31f) + _e371) + (f32(_e373) * 3.1f))))) * (1f - _e382));
            }
            let _e386: f32 = local_9;
            appui = _e386;
            let _e388: i32 = c_7;
            let _e391: f32 = hA;
            let _e393: f32 = lev;
            let _e395: f32 = appui;
            q_2.hanche[_e388] = (mix(_e391, 0f, _e393) + _e395);
            let _e397: i32 = c_7;
            let _e400: f32 = gA;
            let _e402: f32 = lev;
            let _e404: f32 = appui;
            q_2.genou[_e397] = (mix(_e400, 0f, _e402) - (_e404 * 2f));
            let _e408: i32 = c_7;
            let _e411: i32 = c_7;
            let _e414: f32 = q_2.hanche[_e411];
            let _e415: i32 = c_7;
            let _e418: f32 = q_2.genou[_e415];
            q_2.cheville[_e408] = -((_e414 + _e418));
            let _e421: i32 = c_7;
            let _e424: f32 = sc;
            let _e428: f32 = h1_;
            let _e431: f32 = lev;
            q_2.ecart[_e421] = (_e424 * mix(0.02f, (0.035f + (0.02f * _e428)), _e431));
            let _e434: i32 = c_7;
            let _e437: f32 = sc;
            let _e438: f32 = ouvre;
            let _e441: f32 = h3_;
            let _e444: f32 = lev;
            q_2.ouvre[_e434] = (_e437 * mix(_e438, (0.12f + (0.1f * _e441)), _e444));
        }
        continuing {
            let _e352: i32 = c_7;
            c_7 = (_e352 + 1i);
        }
    }
    let _e448: bool = assis;
    if _e448 {
        let _e449: u32 = posture;
        if (_e449 == 1u) {
            local_11 = vec4<f32>(0.3f, 0.1f, 0.5f, 1.25f);
        } else {
            let _e457: u32 = posture;
            if (_e457 == 2u) {
                local_10 = vec4<f32>(0.08f, 0.06f, 0.62f, 0.85f);
            } else {
                let _e467: f32 = h2_;
                let _e474: f32 = h3_;
                local_10 = vec4<f32>((0.2f + (0.06f * _e467)), 0.07f, 0.45f, (0.8f + (0.08f * _e474)));
            }
            let _e479: vec4<f32> = local_10;
            local_11 = _e479;
        }
        let _e481: vec4<f32> = local_11;
        R0_ = _e481;
    } else {
        let _e482: u32 = posture;
        if (_e482 == 1u) {
            local_13 = vec4<f32>(-0.05f, 0.16f, 0.25f, 0.35f);
        } else {
            let _e491: u32 = posture;
            if (_e491 == 2u) {
                local_12 = vec4<f32>(0.55f, 0.05f, 1.1f, 1.6f);
            } else {
                let _e501: f32 = h3_;
                let _e506: f32 = h2_;
                let _e512: f32 = h2_;
                local_12 = vec4<f32>((0.03f + (0.05f * _e501)), (0.06f + (0.04f * _e506)), 0.12f, (0.12f + (0.25f * _e512)));
            }
            let _e517: vec4<f32> = local_12;
            local_13 = _e517;
        }
        let _e519: vec4<f32> = local_13;
        R0_ = _e519;
    }
    let _e520: vec4<f32> = R0_;
    let _e526: bool = assis;
    if _e526 {
        let _e527: f32 = lev;
        local_14 = _e527;
    } else {
        local_14 = 0f;
    }
    let _e530: f32 = local_14;
    R0_ = mix(_e520, vec4<f32>(0.05f, 0.06f, 0.12f, 0.2f), vec4(_e530));
    loop {
        let _e535: i32 = c_8;
        if !((_e535 < 2i)) {
            break;
        }
        {
            let _e542: vec4<f32> = R0_;
            r = _e542;
            let _e544: bool = assis;
            let _e546: u32 = posture;
            let _e550: i32 = c_8;
            if ((!(_e544) && (_e546 == 2u)) && (_e550 == 0i)) {
                r = vec4<f32>(0.47f, 0.05f, 1.05f, 1.75f);
            }
            let _e559: i32 = c_8;
            let _e562: vec4<f32> = r;
            q_2.epaule[_e559] = _e562.x;
            let _e564: i32 = c_8;
            let _e567: vec4<f32> = r;
            q_2.abduction[_e564] = _e567.y;
            let _e569: i32 = c_8;
            let _e572: vec4<f32> = r;
            q_2.dedans[_e569] = _e572.z;
            let _e574: i32 = c_8;
            let _e577: vec4<f32> = r;
            q_2.coude[_e574] = _e577.w;
            let _e579: i32 = c_8;
            q_2.balancier[_e579] = 0f;
        }
        continuing {
            let _e539: i32 = c_8;
            c_8 = (_e539 + 1i);
        }
    }
    let _e583: bool = applaudit;
    if _e583 {
        {
            let _e586: f32 = t;
            let _e587: f32 = om;
            let _e591: f32 = ph;
            k_5 = (0.5f + (0.5f * sin((((_e586 * _e587) * 1.2f) + _e591))));
            loop {
                let _e599: i32 = c_9;
                if !((_e599 < 2i)) {
                    break;
                }
                {
                    let _e606: i32 = c_9;
                    let _e609: i32 = c_9;
                    let _e612: f32 = q_2.epaule[_e609];
                    let _e614: f32 = agite;
                    q_2.epaule[_e606] = mix(_e612, 1f, _e614);
                    let _e616: i32 = c_9;
                    let _e619: i32 = c_9;
                    let _e622: f32 = q_2.coude[_e619];
                    let _e624: f32 = agite;
                    q_2.coude[_e616] = mix(_e622, 1.2f, _e624);
                    let _e626: i32 = c_9;
                    let _e629: i32 = c_9;
                    let _e632: f32 = q_2.abduction[_e629];
                    let _e634: f32 = agite;
                    q_2.abduction[_e626] = mix(_e632, 0.02f, _e634);
                    let _e636: i32 = c_9;
                    let _e639: i32 = c_9;
                    let _e642: f32 = q_2.dedans[_e639];
                    let _e645: f32 = k_5;
                    let _e648: f32 = agite;
                    q_2.dedans[_e636] = mix(_e642, (0.72f + (0.32f * _e645)), _e648);
                }
                continuing {
                    let _e603: i32 = c_9;
                    c_9 = (_e603 + 1i);
                }
            }
        }
    } else {
        {
            loop {
                let _e652: i32 = c_10;
                if !((_e652 < 2i)) {
                    break;
                }
                {
                    let _e659: i32 = c_10;
                    let _e662: bool = deuxBras;
                    if ((_e659 == 1i) || _e662) {
                        let _e664: f32 = agite;
                        local_15 = _e664;
                    } else {
                        local_15 = 0f;
                    }
                    let _e667: f32 = local_15;
                    bras = _e667;
                    let _e669: f32 = t;
                    let _e670: f32 = om;
                    let _e674: f32 = ph;
                    let _e676: i32 = c_10;
                    k_6 = sin(((((_e669 * _e670) * 0.62f) + _e674) + (f32(_e676) * 1.7f)));
                    let _e683: i32 = c_10;
                    let _e686: i32 = c_10;
                    let _e689: f32 = q_2.epaule[_e686];
                    let _e692: f32 = t;
                    let _e695: f32 = ph;
                    let _e700: f32 = bras;
                    q_2.epaule[_e683] = mix(_e689, (2.55f + (0.12f * sin(((_e692 * 1.7f) + _e695)))), _e700);
                    let _e702: i32 = c_10;
                    let _e705: i32 = c_10;
                    let _e708: f32 = q_2.abduction[_e705];
                    let _e712: f32 = k_6;
                    let _e715: f32 = bras;
                    q_2.abduction[_e702] = mix(_e708, (-0.3f + (0.1f * _e712)), _e715);
                    let _e717: i32 = c_10;
                    let _e720: i32 = c_10;
                    let _e723: f32 = q_2.dedans[_e720];
                    let _e725: f32 = bras;
                    q_2.dedans[_e717] = mix(_e723, 0f, _e725);
                    let _e727: i32 = c_10;
                    let _e730: i32 = c_10;
                    let _e733: f32 = q_2.coude[_e730];
                    let _e736: f32 = t;
                    let _e737: f32 = om;
                    let _e741: f32 = ph;
                    let _e743: i32 = c_10;
                    let _e751: f32 = bras;
                    q_2.coude[_e727] = mix(_e733, (0.32f + (0.12f * sin((((((_e736 * _e737) * 0.62f) + _e741) + f32(_e743)) + 1f)))), _e751);
                    let _e753: i32 = c_10;
                    let _e757: f32 = k_6;
                    let _e759: f32 = bras;
                    q_2.balancier[_e753] = ((0.42f * _e757) * _e759);
                }
                continuing {
                    let _e656: i32 = c_10;
                    c_10 = (_e656 + 1i);
                }
            }
        }
    }
    let _e761: f32 = parapluie;
    if (_e761 > 0f) {
        {
            let _e770: f32 = q_2.epaule.y;
            let _e772: f32 = parapluie;
            q_2.epaule[1i] = mix(_e770, 0.62f, _e772);
            let _e780: f32 = q_2.coude.y;
            let _e782: f32 = parapluie;
            q_2.coude[1i] = mix(_e780, 1.82f, _e782);
            let _e790: f32 = q_2.abduction.y;
            let _e792: f32 = parapluie;
            q_2.abduction[1i] = mix(_e790, 0.1f, _e792);
            let _e800: f32 = q_2.dedans.y;
            let _e802: f32 = parapluie;
            q_2.dedans[1i] = mix(_e800, 0.2f, _e802);
            let _e810: f32 = q_2.balancier.y;
            let _e812: f32 = parapluie;
            q_2.balancier[1i] = (_e810 * (1f - _e812));
        }
    }
    let _e815: f32 = drapeau;
    if (_e815 > 0f) {
        {
            let _e818: f32 = t;
            let _e821: f32 = ph;
            k_7 = sin(((_e818 * 7f) + _e821));
            let _e831: f32 = q_2.epaule.x;
            let _e834: f32 = k_7;
            let _e837: f32 = drapeau;
            q_2.epaule[0i] = mix(_e831, (2.55f + (0.2f * _e834)), _e837);
            let _e845: f32 = q_2.abduction.x;
            let _e849: f32 = k_7;
            let _e852: f32 = drapeau;
            q_2.abduction[0i] = mix(_e845, (-0.25f + (0.3f * _e849)), _e852);
            let _e860: f32 = q_2.dedans.x;
            let _e862: f32 = drapeau;
            q_2.dedans[0i] = mix(_e860, 0f, _e862);
            let _e870: f32 = q_2.coude.x;
            let _e872: f32 = drapeau;
            q_2.coude[0i] = mix(_e870, 0.25f, _e872);
            q_2.balancier[0i] = 0f;
        }
    }
    let _e878: bool = assis;
    if _e878 {
        let _e879: u32 = posture;
        if (_e879 == 1u) {
            local_17 = 0.34f;
        } else {
            let _e883: u32 = posture;
            if (_e883 == 2u) {
                local_16 = -0.1f;
            } else {
                let _e890: f32 = h1_;
                local_16 = (0.02f + (0.05f * _e890));
            }
            let _e894: f32 = local_16;
            local_17 = _e894;
        }
        let _e896: f32 = local_17;
        local_18 = _e896;
    } else {
        local_18 = 0.02f;
    }
    let _e899: f32 = local_18;
    penche = _e899;
    let _e903: f32 = penche;
    let _e905: f32 = lev;
    let _e907: bool = assis;
    if _e907 {
        let _e910: f32 = lever;
        local_19 = (0.5f * sin((3.1415927f * _e910)));
    } else {
        local_19 = 0f;
    }
    let _e916: f32 = local_19;
    let _e919: f32 = souffle;
    let _e923: f32 = agite;
    let _e925: f32 = t;
    let _e926: f32 = om;
    let _e930: f32 = ph;
    q_2.torse.x = (((mix(_e903, 0.03f, _e905) + _e916) + (0.012f * _e919)) + ((0.06f * _e923) * sin((((_e925 * _e926) * 0.62f) + _e930))));
    let _e938: f32 = t;
    let _e941: f32 = ph;
    let _e946: f32 = agite;
    let _e948: f32 = t;
    let _e949: f32 = om;
    let _e953: f32 = ph;
    q_2.torse.y = ((0.022f * sin(((_e938 * 0.43f) + _e941))) + ((0.03f * _e946) * sin((((_e948 * _e949) * 0.31f) + _e953))));
    let _e958: vec2<i32> = t0_;
    let _e960: vec4<f32> = textureLoad(uPublicF_texture, _e958, 0i);
    A = _e960;
    let _e962: vec2<i32> = t1_;
    let _e964: vec4<f32> = textureLoad(uPublicF_texture, _e962, 0i);
    Bf = _e964;
    let _e966: vec4<f32> = A;
    ancre = _e966.xyz;
    let _e969: vec4<f32> = A;
    cap = _e969.w;
    let _e972: f32 = cap;
    cc = cos(_e972);
    let _e975: f32 = cap;
    sc_1 = sin(_e975);
    let _e978: f32 = cc;
    let _e980: f32 = sc_1;
    X = vec3<f32>(_e978, 0f, -(_e980));
    let _e984: f32 = sc_1;
    let _e986: f32 = cc;
    Fv = vec3<f32>(_e984, 0f, _e986);
    let _e989: vec3<f32> = ancre;
    let _e993: vec4<f32> = Bf;
    let _e996: f32 = lev;
    let _e1001: vec3<f32> = Fv;
    let _e1002: vec4<f32> = Bf;
    let _e1005: f32 = lev;
    teteMonde = ((_e989 + vec3<f32>(0f, mix(0.62f, (1.62f - _e993.y), _e996), 0f)) + ((_e1001 * _e1002.x) * _e1005));
    let _e1009: vec4<f32> = S;
    let _e1011: vec3<f32> = teteMonde;
    d_1 = (_e1009.xyz - _e1011);
    let _e1014: vec3<f32> = d_1;
    let _e1015: vec3<f32> = X;
    lx = dot(_e1014, _e1015);
    let _e1018: vec3<f32> = d_1;
    let _e1019: vec3<f32> = Fv;
    lz = dot(_e1018, _e1019);
    let _e1022: f32 = lx;
    let _e1023: f32 = lz;
    lacet = atan2(_e1022, _e1023);
    let _e1026: vec3<f32> = d_1;
    let _e1029: f32 = lx;
    let _e1030: f32 = lz;
    tangage = atan2(_e1026.y, max(0.5f, length(vec2<f32>(_e1029, _e1030))));
    let _e1036: vec4<f32> = S2_;
    let _e1040: f32 = h2_;
    let _e1047: f32 = lacet;
    poids = ((_e1036.x * (0.7f + (0.3f * _e1040))) * (1f - smoothstep(1.9f, 2.5f, abs(_e1047))));
    let _e1054: f32 = t;
    let _e1057: f32 = h2_;
    let _e1061: f32 = ph;
    let _e1068: f32 = t;
    let _e1071: f32 = h1_;
    oisif = ((0.38f * sin(((_e1054 * (0.09f + (0.06f * _e1057))) + (_e1061 * 1.3f)))) + (0.16f * sin(((_e1068 * 0.27f) + (_e1071 * 9f)))));
    let _e1079: f32 = oisif;
    let _e1080: f32 = lacet;
    let _e1085: f32 = poids;
    lacet = mix(_e1079, clamp(_e1080, -1.5f, 1.5f), _e1085);
    let _e1090: f32 = lacet;
    q_2.torse.z = (0.3f * _e1090);
    let _e1094: f32 = lacet;
    let _e1095: Pose = q_2;
    q_2.tete.x = clamp((_e1094 - _e1095.torse.z), -1.15f, 1.15f);
    let _e1107: f32 = t;
    let _e1110: f32 = ph;
    let _e1115: f32 = tangage;
    let _e1119: f32 = poids;
    let _e1126: f32 = agite;
    let _e1129: f32 = parapluie;
    q_2.tete.y = (clamp(mix((0.08f + (0.06f * sin(((_e1107 * 0.21f) + _e1110)))), (-(_e1115) * 0.8f), _e1119), -0.35f, 0.5f) - ((0.25f * _e1126) * (1f - _e1129)));
    let _e1133: u32 = traits;
    if (((_e1133 >> 17u) & 1u) == 1u) {
        let _e1143: f32 = t;
        let _e1144: f32 = om;
        let _e1148: f32 = ph;
        let _e1155: f32 = agite;
        local_20 = ((0.06f * max(0f, sin((((_e1143 * _e1144) * 0.7f) + _e1148)))) * smoothstep(0.5f, 0.9f, _e1155));
    } else {
        local_20 = 0f;
    }
    let _e1160: f32 = local_20;
    saut = _e1160;
    let _e1162: vec3<f32> = aPosition_1;
    p_1 = _e1162;
    let _e1164: vec3<f32> = aNormale_1;
    n_1 = _e1164;
    let _e1166: vec3<f32> = aPosition_1;
    objet = _e1166;
    let _e1168: u32 = os_2;
    let _e1171: vec3<f32> = p_1;
    if ((_e1168 == 1u) && (_e1171.y > 1.54f)) {
        {
            let _e1176: u32 = traits;
            v_6 = ((f32(((_e1176 >> 24u) & 15u)) / 7.5f) - 1f);
            let _e1188: vec3<f32> = p_1;
            jaw = exp(-(pow(((_e1188.y - 1.605f) / 0.052f), 2f)));
            let _e1199: vec3<f32> = p_1;
            upper = clamp(((_e1199.y - 1.54f) / 0.1f), 0f, 1f);
            let _e1210: vec3<f32> = p_1;
            let _e1213: f32 = v_6;
            let _e1216: f32 = jaw;
            let _e1220: f32 = upper;
            p_1.x = (_e1210.x * (1f + ((_e1213 * (0.025f + (0.035f * _e1216))) * _e1220)));
            let _e1225: vec3<f32> = p_1;
            let _e1227: f32 = v_6;
            let _e1230: vec3<f32> = p_1;
            let _e1236: vec3<f32> = p_1;
            let _e1249: vec3<f32> = p_1;
            p_1.z = (_e1225.z + (((_e1227 * 0.003f) * exp(-((pow((_e1230.x / 0.02f), 2f) + pow(((_e1236.y - 1.675f) / 0.035f), 2f))))) * max(0f, (_e1249.z / 0.1f))));
        }
    }
    let _e1256: u32 = traits;
    let _e1264: u32 = os_2;
    let _e1268: u32 = os_2;
    let _e1272: vec3<f32> = p_1;
    if ((((((_e1256 >> 10u) & 1u) == 1u) && (_e1264 <= 3u)) && (_e1268 != 1u)) && (_e1272.y > 1.2f)) {
        let _e1278: vec3<f32> = p_1;
        let _e1284: vec3<f32> = p_1;
        p_1.x = (_e1278.x * (1f - (0.025f * smoothstep(1.2f, 1.44f, _e1284.y))));
    }
    let _e1290: u32 = os_2;
    if (_e1290 == 1u) {
        {
            let _e1294: vec4<f32> = Bf;
            k_8 = pow(clamp((1f / _e1294.z), 1f, 1.4f), 0.6f);
            let _e1303: vec3<f32> = p_1;
            let _e1305: f32 = k_8;
            p_1 = (PIV_COU + ((_e1303 - PIV_COU) * _e1305));
        }
    }
    let _e1308: u32 = partie;
    let _e1311: u32 = traits;
    if ((_e1308 == 5u) && (((_e1311 >> 14u) & 1u) == 1u)) {
        {
            let _e1320: vec3<f32> = p_1;
            let _e1323: vec3<f32> = p_1;
            let _e1327: vec3<f32> = p_1;
            p_1 = vec3<f32>(-(_e1320.x), _e1323.y, (-0.008f - _e1327.z));
            let _e1331: vec3<f32> = n_1;
            let _e1334: vec3<f32> = n_1;
            let _e1336: vec3<f32> = n_1;
            n_1 = vec3<f32>(-(_e1331.x), _e1334.y, -(_e1336.z));
        }
    }
    let _e1340: u32 = partie;
    if (_e1340 == 9u) {
        {
            let _e1351: f32 = capuche;
            a_6 = (1.75f * (1f - _e1351));
            let _e1357: f32 = capuche;
            e = mix(0.5f, 1f, _e1357);
            let _e1360: vec3<f32> = k_9;
            let _e1361: vec3<f32> = p_1;
            let _e1362: vec3<f32> = k_9;
            let _e1365: f32 = e;
            let _e1366: f32 = e;
            let _e1369: f32 = a_6;
            let _e1370: vec3<f32> = rx(((_e1361 - _e1362) * vec3<f32>(1f, _e1365, _e1366)), _e1369);
            p_1 = (_e1360 + _e1370);
            let _e1372: vec3<f32> = n_1;
            let _e1375: f32 = e;
            let _e1378: f32 = e;
            let _e1383: f32 = a_6;
            let _e1384: vec3<f32> = rx(normalize((_e1372 * vec3<f32>(1f, (1f / _e1375), (1f / _e1378)))), _e1383);
            n_1 = _e1384;
        }
    }
    let _e1385: u32 = partie;
    if (_e1385 == 11u) {
        {
            let _e1388: vec2<f32> = aPoids_1;
            u = _e1388.y;
            let _e1392: vec3<f32> = p_1;
            let _e1395: f32 = u;
            let _e1397: f32 = t;
            let _e1400: f32 = u;
            let _e1404: f32 = ph;
            let _e1408: f32 = drapeau;
            p_1.z = (_e1392.z + (((0.07f * _e1395) * sin((((_e1397 * 11f) - (_e1400 * 7f)) + _e1404))) * _e1408));
            let _e1414: vec3<f32> = p_1;
            let _e1418: f32 = drapeau;
            p_1.x = (-0.26f + ((_e1414.x + 0.26f) * _e1418));
            let _e1423: vec3<f32> = p_1;
            let _e1427: f32 = drapeau;
            p_1.y = (0.905f + ((_e1423.y - 0.905f) * _e1427));
        }
    }
    let _e1430: u32 = partie;
    if (_e1430 == 10u) {
        {
            let _e1446: Pose = q_2;
            poserOs((&main_1), (&mn), 19u, _e1446);
            let _e1449: vec3<f32> = p_1;
            if (_e1449.y > 0.7f) {
                let _e1455: f32 = parapluie;
                local_21 = mix(0.08f, 1f, _e1455);
            } else {
                local_21 = 1f;
            }
            let _e1459: f32 = local_21;
            r_1 = _e1459;
            let _e1461: vec3<f32> = p_1;
            let _e1463: f32 = r_1;
            let _e1465: vec3<f32> = p_1;
            let _e1467: vec3<f32> = p_1;
            let _e1469: f32 = r_1;
            let _e1473: vec3<f32> = rx(vec3<f32>((_e1461.x * _e1463), _e1465.y, (_e1467.z * _e1469)), 0.22f);
            l = _e1473;
            let _e1475: vec3<f32> = n_1;
            let _e1477: vec3<f32> = rx(_e1475, 0.22f);
            n_1 = _e1477;
            let _e1478: vec3<f32> = main_1;
            let _e1479: vec3<f32> = l;
            p_1 = (_e1478 + _e1479);
        }
    } else {
        {
            let _e1481: vec3<f32> = p_1;
            pa = _e1481;
            let _e1483: vec3<f32> = n_1;
            na = _e1483;
            let _e1487: u32 = os_2;
            let _e1488: Pose = q_2;
            poserOs((&pa), (&na), _e1487, _e1488);
            let _e1491: vec4<u32> = aInfo_1;
            if ((_e1491.w & 32u) != 0u) {
                {
                    let _e1497: vec3<f32> = p_1;
                    pb = _e1497;
                    let _e1499: vec3<f32> = n_1;
                    nb = _e1499;
                    let _e1503: vec2<f32> = aPoids_1;
                    let _e1508: Pose = q_2;
                    poserOs((&pb), (&nb), u32((_e1503.x + 0.5f)), _e1508);
                    let _e1511: vec3<f32> = pa;
                    let _e1512: vec3<f32> = pb;
                    let _e1513: vec2<f32> = aPoids_1;
                    pa = mix(_e1511, _e1512, vec3(_e1513.y));
                    let _e1517: vec3<f32> = na;
                    let _e1518: vec3<f32> = nb;
                    let _e1519: vec2<f32> = aPoids_1;
                    na = mix(_e1517, _e1518, vec3(_e1519.y));
                }
            }
            let _e1523: vec3<f32> = pa;
            p_1 = _e1523;
            let _e1524: vec3<f32> = na;
            n_1 = _e1524;
        }
    }
    let _e1525: vec4<f32> = Bf;
    let _e1527: vec4<f32> = Bf;
    let _e1531: vec4<f32> = Bf;
    echelle = vec3<f32>(_e1525.w, _e1527.z, (0.5f + (0.5f * _e1531.w)));
    let _e1540: f32 = lev;
    pivot = vec3<f32>(0f, (0.97f * (1f - _e1540)), 0f);
    let _e1546: vec3<f32> = pivot;
    let _e1547: vec3<f32> = p_1;
    let _e1548: vec3<f32> = pivot;
    let _e1550: vec3<f32> = echelle;
    p_1 = (_e1546 + ((_e1547 - _e1548) * _e1550));
    let _e1553: vec3<f32> = n_1;
    let _e1554: vec3<f32> = echelle;
    n_1 = (_e1553 / _e1554);
    let _e1556: vec3<f32> = p_1;
    let _e1563: vec4<f32> = Bf;
    let _e1566: vec4<f32> = Bf;
    let _e1569: f32 = lev;
    p_1 = (_e1556 + mix(vec3<f32>(0f, -0.97f, 0f), vec3<f32>(0f, -(_e1563.y), _e1566.x), vec3(_e1569)));
    let _e1574: vec3<f32> = p_1;
    let _e1576: f32 = saut;
    p_1.y = (_e1574.y + _e1576);
    let _e1578: vec3<f32> = ancre;
    let _e1579: vec3<f32> = X;
    let _e1580: vec3<f32> = p_1;
    let _e1585: vec3<f32> = p_1;
    let _e1590: vec3<f32> = Fv;
    let _e1591: vec3<f32> = p_1;
    monde = (((_e1578 + (_e1579 * _e1580.x)) + vec3<f32>(0f, _e1585.y, 0f)) + (_e1590 * _e1591.z));
    let _e1599: vec4<f32> = ferroUniforms.data[0];
    let _e1605: vec4<f32> = ferroUniforms.data[1];
    let _e1611: vec4<f32> = ferroUniforms.data[2];
    let _e1617: vec4<f32> = ferroUniforms.data[3];
    let _e1639: vec3<f32> = monde;
    gl_Position = (mat4x4<f32>(vec4<f32>(_e1599.x, _e1599.y, _e1599.z, _e1599.w), vec4<f32>(_e1605.x, _e1605.y, _e1605.z, _e1605.w), vec4<f32>(_e1611.x, _e1611.y, _e1611.z, _e1611.w), vec4<f32>(_e1617.x, _e1617.y, _e1617.z, _e1617.w)) * vec4<f32>(_e1639.x, _e1639.y, _e1639.z, 1f));
    return;
}

fn main_2() {
    ferro_main();
    let _e16: vec4<f32> = gl_Position;
    let _e18: vec4<f32> = gl_Position;
    gl_Position.z = ((_e16.z + _e18.w) * 0.5f);
    return;
}

@vertex
fn main(@location(0) aPosition: vec3<f32>, @location(1) aNormale: vec3<f32>, @location(2) aPoids: vec2<f32>, @location(3) aInfo: vec4<u32>, @location(4) aSpectateur: u32) -> VertexOutput {
    aPosition_1 = aPosition;
    aNormale_1 = aNormale;
    aPoids_1 = aPoids;
    aInfo_1 = aInfo;
    aSpectateur_1 = aSpectateur;
    main_2();
    let _e36: vec4<f32> = gl_Position;
    return VertexOutput(_e36);
}
`,
      fragment: `diagnostic(off, derivative_uniformity);
struct FerroUniforms {
    data: array<vec4<f32>, 101>,
}

@group(0) @binding(0)
var<uniform> ferroUniforms: FerroUniforms;
@group(0) @binding(1)
var uPublicF_texture: texture_2d<f32>;
@group(0) @binding(2)
var uPublicF_sampler: sampler;
@group(0) @binding(3)
var uPublicU_texture: texture_2d<u32>;
@group(0) @binding(4)
var uPublicU_sampler: sampler;

fn ferro_uSections(index: i32) -> vec4<f32> {
    var index_1: i32;

    index_1 = index;
    let _e6: i32 = index_1;
    let _e12: vec4<f32> = ferroUniforms.data[(5i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn ferro_uSections2_(index_2: i32) -> vec4<f32> {
    var index_3: i32;

    index_3 = index_2;
    let _e6: i32 = index_3;
    let _e12: vec4<f32> = ferroUniforms.data[(53i + (_e6 * 1i))];
    return _e12.xyzw;
}

fn main_1() {
    return;
}

@fragment
fn main() {
    main_1();
    return;
}
`,
    },
  };
})(globalThis.BITUME = globalThis.BITUME || {});
