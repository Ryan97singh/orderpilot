package com.orderpilot.core.api.dto;

import com.orderpilot.core.security.CurrentUser;
import com.orderpilot.core.security.Role;
import java.util.List;

public record UserDto(String id, String name, String email, List<Role> roles) {

    public static UserDto from(CurrentUser user) {
        return new UserDto(user.id(), user.name(), user.email(), user.roles());
    }
}
