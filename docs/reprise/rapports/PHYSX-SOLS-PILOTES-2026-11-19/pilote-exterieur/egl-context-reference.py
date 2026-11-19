#!/usr/bin/env python3
"""Execute FERRO's real GLSL vertex shader with surfaceless Mesa transform feedback.

This is a shader correctness test, not a browser or hardware FPS benchmark.
Requires libEGL/libGL and Node; no imported visual assets or renderer substitute.
"""
import argparse
import ctypes as C
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def extract(path):
    script = """const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);
let source=fs.readFileSync(process.argv[1],'utf8').replace('globalThis.FRender=',
'globalThis.shaders={VERT,FRAG,DEPTH_FRAG,POST_VERT,SKY_FRAG};globalThis.FRender=');vm.runInContext(source,c);
const states={};if(c.FRender.shared.localWindState){
const source={id:1,p:[0,.35,0],velocity:[60,0,0],radius:8,wake:30},wind=c.FRender.shared.localWindState();
for(let n=0;n<=120;n++)wind.update([source],n/60);
const snap=()=>{const f=wind.select([0,1,0]);return {count:f.count,positions:Array.from(f.positions),motions:Array.from(f.motions)}};
states.moving=snap();wind.update([],2.1);states.releasing=snap();
source.p[0]=10;wind.update([source],2.2);states.wake=snap();
source.p[0]=100;wind.update([source],2.3);states.distant=snap();
}console.log(JSON.stringify({shaders:c.shaders,states}));"""
    return json.loads(subprocess.check_output([shutil.which('node'), '-e', script, str(path)], text=True))


class Context:
    def __init__(self, width=16, height=16):
        os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE', '1')
        self.egl = C.CDLL('libEGL.so.1')
        self.gl = C.CDLL('libGL.so.1')
        self.egl.eglGetProcAddress.argtypes = [C.c_char_p]
        self.egl.eglGetProcAddress.restype = C.c_void_p
        display = C.CFUNCTYPE(C.c_void_p, C.c_uint, C.c_void_p, C.POINTER(C.c_int))(
            self.egl.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
        self.display = display(0x31DD, None, None)
        major, minor = C.c_int(), C.c_int()
        self.ef('eglInitialize', C.c_uint, C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_int))
        assert self.egl.eglInitialize(self.display, C.byref(major), C.byref(minor)), 'EGL initialization'
        self.ef('eglBindAPI', C.c_uint, C.c_uint)
        assert self.egl.eglBindAPI(0x30A2), 'OpenGL API'
        config, count = C.c_void_p(), C.c_int()
        attrs = (C.c_int * 11)(0x3033, 1, 0x3040, 8, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3038)
        self.ef('eglChooseConfig', C.c_uint, C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_void_p), C.c_int, C.POINTER(C.c_int))
        assert self.egl.eglChooseConfig(self.display, attrs, C.byref(config), 1, C.byref(count)) and count.value
        self.ef('eglCreatePbufferSurface', C.c_void_p, C.c_void_p, C.c_void_p, C.POINTER(C.c_int))
        self.surface = self.egl.eglCreatePbufferSurface(self.display, config, (C.c_int * 5)(0x3057, width, 0x3056, height, 0x3038))
        self.width, self.height = width, height
        self.ef('eglCreateContext', C.c_void_p, C.c_void_p, C.c_void_p, C.c_void_p, C.POINTER(C.c_int))
        self.context = self.egl.eglCreateContext(self.display, config, None, (C.c_int * 5)(0x3098, 3, 0x30FB, 3, 0x3038))
        self.ef('eglMakeCurrent', C.c_uint, C.c_void_p, C.c_void_p, C.c_void_p, C.c_void_p)
        assert self.egl.eglMakeCurrent(self.display, self.surface, self.surface, self.context)
        self.fn('glGetString', C.c_char_p, C.c_uint)
        self.info = {'renderer': self.gl.glGetString(0x1F01).decode(), 'version': self.gl.glGetString(0x1F02).decode(), 'egl': f'{major.value}.{minor.value}'}
        self.fn('glCreateShader', C.c_uint, C.c_uint)
        self.fn('glShaderSource', None, C.c_uint, C.c_int, C.POINTER(C.c_char_p), C.POINTER(C.c_int))
        self.fn('glCompileShader', None, C.c_uint)
        self.fn('glGetShaderiv', None, C.c_uint, C.c_uint, C.POINTER(C.c_int))
        self.fn('glGetShaderInfoLog', None, C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_char_p)
        self.fn('glCreateProgram', C.c_uint)
        self.fn('glAttachShader', None, C.c_uint, C.c_uint)
        self.fn('glTransformFeedbackVaryings', None, C.c_uint, C.c_int, C.POINTER(C.c_char_p), C.c_uint)
        self.fn('glLinkProgram', None, C.c_uint)
        self.fn('glGetProgramiv', None, C.c_uint, C.c_uint, C.POINTER(C.c_int))
        self.fn('glGetProgramInfoLog', None, C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_char_p)
        self.fn('glGenVertexArrays', None, C.c_int, C.POINTER(C.c_uint))
        self.fn('glBindVertexArray', None, C.c_uint)
        self.fn('glGenBuffers', None, C.c_int, C.POINTER(C.c_uint))
        self.fn('glBindBuffer', None, C.c_uint, C.c_uint)
        self.fn('glBufferData', None, C.c_uint, C.c_ssize_t, C.c_void_p, C.c_uint)
        self.fn('glBindBufferBase', None, C.c_uint, C.c_uint, C.c_uint)
        self.fn('glGetBufferSubData', None, C.c_uint, C.c_ssize_t, C.c_ssize_t, C.c_void_p)
        self.fn('glVertexAttribPointer', None, C.c_uint, C.c_int, C.c_uint, C.c_ubyte, C.c_int, C.c_void_p)
        self.fn('glEnableVertexAttribArray', None, C.c_uint)
        self.fn('glVertexAttrib4f', None, C.c_uint, C.c_float, C.c_float, C.c_float, C.c_float)
        self.fn('glUseProgram', None, C.c_uint)
        self.fn('glGetUniformLocation', C.c_int, C.c_uint, C.c_char_p)
        self.fn('glUniformMatrix4fv', None, C.c_int, C.c_int, C.c_ubyte, C.POINTER(C.c_float))
        self.fn('glUniform2f', None, C.c_int, C.c_float, C.c_float)
        self.fn('glUniform1f', None, C.c_int, C.c_float)
        self.fn('glUniform1i', None, C.c_int, C.c_int)
        self.fn('glUniform4fv', None, C.c_int, C.c_int, C.POINTER(C.c_float))
        self.fn('glEnable', None, C.c_uint)
        self.fn('glDisable', None, C.c_uint)
        self.fn('glBeginTransformFeedback', None, C.c_uint)
        self.fn('glEndTransformFeedback', None)
        self.fn('glDrawArrays', None, C.c_uint, C.c_int, C.c_int)
        self.fn('glGetError', C.c_uint)
        self.vao = C.c_uint()
        self.gl.glGenVertexArrays(1, C.byref(self.vao))
        self.gl.glBindVertexArray(self.vao.value)
        self.buffers = (C.c_uint * 2)()
        self.gl.glGenBuffers(2, self.buffers)
        points = (C.c_float * 9)(0, -.5, 0, 0, .03, 0, 0, .5, 0)
        self.gl.glBindBuffer(0x8892, self.buffers[0])
        self.gl.glBufferData(0x8892, C.sizeof(points), points, 0x88E4)
        self.gl.glVertexAttribPointer(0, 3, 0x1406, 0, 0, None)
        self.gl.glEnableVertexAttribArray(0)
        self.gl.glBindBuffer(0x8C8E, self.buffers[1])
        self.gl.glBufferData(0x8C8E, C.sizeof(points), None, 0x88E5)
        self.gl.glBindBufferBase(0x8C8E, 0, self.buffers[1])

    def ef(self, name, result, *args):
        f = getattr(self.egl, name); f.restype = result; f.argtypes = list(args)

    def fn(self, name, result, *args):
        f = getattr(self.gl, name); f.restype = result; f.argtypes = list(args)

    def program(self, vertex, fragment, varyings=('vWorld',)):
        g = self.gl
        program = g.glCreateProgram()
        for stage, source in [(0x8B31, vertex), (0x8B30, fragment)]:
            shader = g.glCreateShader(stage)
            encoded = C.c_char_p(source.encode())
            g.glShaderSource(shader, 1, C.byref(encoded), None); g.glCompileShader(shader)
            valid = C.c_int(); g.glGetShaderiv(shader, 0x8B81, C.byref(valid))
            if not valid.value:
                message = C.create_string_buffer(65536); g.glGetShaderInfoLog(shader, len(message), None, message)
                raise AssertionError(message.value.decode())
            g.glAttachShader(program, shader)
        if varyings:
            names = (C.c_char_p * len(varyings))(*(name.encode() for name in varyings))
            g.glTransformFeedbackVaryings(program, len(varyings), names, 0x8C8C)
        g.glLinkProgram(program)
        valid = C.c_int(); g.glGetProgramiv(program, 0x8B82, C.byref(valid))
        if not valid.value:
            message = C.create_string_buffer(65536); g.glGetProgramInfoLog(program, len(message), None, message)
            raise AssertionError(message.value.decode())
        return program

    def sample(self, program, state=None, *, flags=14, ambient=0, height=.36, position=(0, 0, 0), time=2):
        g = self.gl
        g.glUseProgram(program)
        loc = lambda name: g.glGetUniformLocation(program, name.encode())
        identity = (C.c_float * 16)(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
        g.glUniformMatrix4fv(loc('uViewProjection'), 1, 0, identity)
        g.glUniform2f(loc('uWindTime'), ambient, time); g.glUniform1f(loc('uSeaMode'), 0)
        for unit, name in enumerate(['uPbrAlbedo', 'uPbrNormal', 'uPbrRough', 'uShadowMap', 'uVoile']):
            g.glUniform1i(loc(name), unit)
        g.glUniform1i(loc('uLocalWindCount'), state['count'] if state else 0)
        for name, key in [('uLocalWindPosition', 'positions'), ('uLocalWindMotion', 'motions')]:
            g.glUniform4fv(loc(name), 4, (C.c_float * 16)(*(state[key] if state else [0] * 16)))
        g.glVertexAttrib4f(1, 0, 1, 0, 0)
        g.glVertexAttrib4f(2, position[0], position[1] + height / 2, position[2], 27)
        g.glVertexAttrib4f(3, 1, height, 1, 0); g.glVertexAttrib4f(4, 0, 0, 0, flags)
        g.glVertexAttrib4f(5, .2, .4, .1, 1)
        g.glEnable(0x8C89); g.glBeginTransformFeedback(0)
        g.glDrawArrays(0, 0, 3); g.glEndTransformFeedback(); g.glDisable(0x8C89)
        output = (C.c_float * 9)(); g.glGetBufferSubData(0x8C8E, 0, C.sizeof(output), output)
        error = g.glGetError(); assert error == 0, f'OpenGL error during transform feedback: {error:#x}'
        return [list(output[i:i + 3]) for i in range(0, 9, 3)]


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True); parser.add_argument('--baseline', type=Path)
    args = parser.parse_args(); data = extract(ROOT / 'src/ferro/renderer.js'); shaders, states = data['shaders'], data['states']
    context = Context(); world = context.program(shaders['VERT'], shaders['FRAG']); depth = context.program(shaders['VERT'], shaders['DEPTH_FRAG'])
    cases = {name: context.sample(world, state) for name, state in states.items()}
    cases['still'] = context.sample(world); cases['nonResponsive'] = context.sample(world, states['moving'], flags=6)
    cases['lateral6m'] = context.sample(world, states['moving'], position=(0, 0, 6))
    cases['depth'] = context.sample(depth, states['moving'])
    assert cases['moving'][0] == cases['still'][0], 'root must remain exactly anchored'
    assert cases['nonResponsive'] == cases['still'], 'ordinary botanical meshes must ignore vehicle wind'
    assert cases['depth'] == cases['moving'], 'colour and shadow vertex positions must match exactly'
    assert cases['distant'] == cases['still'], 'far-source fast rejection must preserve the still positions'
    displacement = lambda value, origin=cases['still']: math.dist(value[2], origin[2])
    assert displacement(cases['moving']) > .025
    assert .01 < displacement(cases['lateral6m'], [[0, 0, 6], [0, .1908, 6], [0, .36, 6]])
    assert 0 < displacement(cases['releasing']) < displacement(cases['moving'])
    assert displacement(cases['wake']) > .01, 'grass behind the moving emitter must retain a directed wake'
    # Four maximum-strength overlapping sources exercise the conservative bound.
    strong = {'count': 4, 'positions': [0, .35, 0, 8] * 4, 'motions': [1, 0, 3, 30] * 4}
    maximum = 0
    for time in [i * .17 for i in range(80)]:
        bent = context.sample(world, strong, ambient=2, height=2, time=time)
        maximum = max(maximum, math.hypot(bent[2][0], bent[2][2]))
        assert bent[0] == [0, 0, 0]
    assert maximum < 3, '1.5 * min(height, 2) metre culling margin must contain the deformed tips'
    middle = cases['moving'][1]
    linear = [cases['moving'][0][k] + .53 * (cases['moving'][2][k] - cases['moving'][0][k]) for k in range(3)]
    error = math.dist(middle, linear)
    baseline_equal = None
    if args.baseline:
        before = extract(args.baseline)['shaders']; old = context.program(before['VERT'], before['FRAG'])
        baseline_equal = all(context.sample(world, flags=6, ambient=wind, time=t, position=(7, 0, 3)) == context.sample(old, flags=6, ambient=wind, time=t, position=(7, 0, 3)) for wind in [0, .6, 2] for t in [0, 1.3, 9])
        assert baseline_equal, 'default deformation must remain bit-identical to the qualified baseline'
    report = {'passed': True, 'environment': context.info, 'cases': cases,
              'maxDisplacementAtHeight2': maximum, 'conservativeWindMarginAtHeight2': 3,
              'movingTipDisplacement': displacement(cases['moving']), 'lodMidpointErrorMetres': error,
              'lodMidpointErrorPixelsAt60m1080p60deg': error * 1080 / (2 * 60 * math.tan(math.pi / 6)),
              'baselineDefaultBitIdentical': baseline_equal,
              'scope': 'Real GLSL vertex execution with llvmpipe transform feedback; not browser, WebGPU execution, or hardware FPS.'}
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'cases'}))


if __name__ == '__main__':
    main()
