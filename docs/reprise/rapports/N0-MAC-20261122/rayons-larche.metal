#include <metal_stdlib>
#include <metal_raytracing>
using namespace metal;
using namespace raytracing;

struct Rayon { float4 origineMin; float4 directionMax; uint4 mode; };
struct Reponse { uint touche; uint triangle; float distance; float u; float v; };

kernel void intersections(primitive_acceleration_structure chaussee [[buffer(0)]],
                          device const Rayon *rayons [[buffer(1)]],
                          device Reponse *sorties [[buffer(2)]],
                          uint i [[thread_position_in_grid]]) {
    const Rayon q = rayons[i];
    ray r(q.origineMin.xyz, q.directionMax.xyz, q.origineMin.w, q.directionMax.w);
    intersector<triangle_data> test;
    test.assume_geometry_type(geometry_type::triangle);
    test.accept_any_intersection(q.mode.x != 0);
    const auto h = test.intersect(r, chaussee);
    Reponse rep = {0, 0, 0, 0, 0};
    if (h.type == intersection_type::triangle) {
        rep = {1, h.primitive_id, h.distance, h.triangle_barycentric_coord.x, h.triangle_barycentric_coord.y};
    }
    sorties[i] = rep;
}
