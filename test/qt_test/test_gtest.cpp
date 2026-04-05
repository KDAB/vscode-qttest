// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

#include <gtest/gtest.h>

TEST(MathTest, Addition) {
    EXPECT_EQ(2 + 2, 4);
    EXPECT_EQ(-1 + 1, 0);
}

TEST(MathTest, Subtraction) {
    EXPECT_EQ(5 - 3, 2);
    EXPECT_EQ(0 - 1, -1);
}

TEST(MathTest, Multiplication) {
    EXPECT_EQ(3 * 4, 12);
    EXPECT_EQ(-2 * 3, -6);
}

TEST(StringTest, Length) {
    EXPECT_EQ(std::string("hello").size(), 5);
    EXPECT_TRUE(std::string("").empty());
}

TEST(StringTest, Concatenation) {
    EXPECT_EQ(std::string("hello") + " world", "hello world");
}
