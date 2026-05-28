import {useMemo as $fyoYl$useMemo, cloneElement as $fyoYl$cloneElement} from "react";

/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */ 
function $91ad91478b215293$export$727c8fc270210f13(props) {
    let { children: children, items: items, idScope: idScope, addIdAndValue: addIdAndValue, dependencies: dependencies = [] } = props;
    // Invalidate the cache whenever the parent value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    let cache = (0, $fyoYl$useMemo)(()=>new WeakMap(), dependencies);
    return (0, $fyoYl$useMemo)(()=>{
        if (items && typeof children === 'function') {
            let res = [];
            for (let item of items){
                let rendered = cache.get(item);
                if (!rendered) {
                    rendered = children(item);
                    var _rendered_props_id, _ref;
                    // @ts-ignore
                    let key = (_ref = (_rendered_props_id = rendered.props.id) !== null && _rendered_props_id !== void 0 ? _rendered_props_id : item.key) !== null && _ref !== void 0 ? _ref : item.id;
                    if (key == null) throw new Error('Could not determine key for item');
                    if (idScope != null && rendered.props.id == null) key = idScope + ':' + key;
                    // Note: only works if wrapped Item passes through id...
                    rendered = (0, $fyoYl$cloneElement)(rendered, addIdAndValue ? {
                        key: key,
                        id: key,
                        value: item
                    } : {
                        key: key
                    });
                    cache.set(item, rendered);
                }
                res.push(rendered);
            }
            return res;
        } else if (typeof children !== 'function') return children;
    }, [
        children,
        items,
        cache,
        idScope,
        addIdAndValue
    ]);
}


export {$91ad91478b215293$export$727c8fc270210f13 as useCachedChildren};
//# sourceMappingURL=useCachedChildren.js.map
